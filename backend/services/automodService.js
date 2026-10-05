const Report = require('../models/Report');
const Community = require('../models/Community');
const CommunityMember = require('../models/CommunityMember');
const logger = require('../utils/logger');

// Global collegiate moderation rules and prohibited patterns
const GLOBAL_RULES = [
  {
    ruleId: 'ACADEMIC_DISHONESTY',
    name: 'Academic Dishonesty & Exam Solicitations',
    reason: 'Prohibited academic dishonesty solicitation or leaked exam materials',
    patterns: [
      /\b(?:buy|purchase|pay for)\s+(?:an?\s+)?(?:essay|paper|assignment|homework|thesis|dissertation)\b/i,
      /\b(?:write|do|complete)\s+my\s+(?:essay|exam|paper|assignment|thesis)\b/i,
      /\b(?:exam|quiz|midterm|final)\s+(?:leak|leaks|leaked|answers)\b/i,
      /\bleak(?:ed)?\s+(?:exam|midterm|final)\b/i,
      /\bpay\s+someone\s+to\s+(?:take|do|pass)\s+(?:my\s+)?(?:exam|class|test)\b/i,
      /\bhire\s+(?:an?\s+)?essay\s+writer\b/i,
      /\b(?:hack|change)\s+(?:grades|canvas|blackboard|moodle)\b/i,
      /\btest\s+bank\s+leak(?:s)?\b/i,
    ],
  },
  {
    ruleId: 'SCAMS_AND_PHISHING',
    name: 'Scams, Phishing & Fraudulent Schemes',
    reason: 'Detected potential financial scam, credential theft, or phishing',
    patterns: [
      /\b(?:free\s+crypto|airdrop\s+claim|crypto\s+giveaway)\b/i,
      /\b(?:telegram|whatsapp)\s+hack(?:er|ing)?\b/i,
      /\b(?:carding|dumps\s+pin|clone\s+cards)\b/i,
      /\b(?:gift\s+card\s+generator|cashapp\s+flip)\b/i,
      /\b(?:make\s+\$?\d{3,5}\s+(?:a|per)\s+(?:day|week)\s+(?:from\s+home|online))\b/i,
      /\bfree\s+robux\b/i,
    ],
  },
  {
    ruleId: 'PROFANITY_HARASSMENT',
    name: 'Severe Harassment & Toxic Slurs',
    reason: 'Content contains prohibited harassment or hateful slurs',
    patterns: [
      /\b(?:kill\s+yourself|kys)\b/i,
    ],
  },
];

/**
 * Normalizes input text for moderation evaluation
 */
const normalizeText = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width chars
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Evaluates text against global automod rules and community custom keywords
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.content
 * @param {string|mongoose.Types.ObjectId} [params.communityId]
 * @param {Object} [params.communityDoc]
 * @returns {Promise<{ flagged: boolean, action: 'quarantine'|'none', matchedRule: string|null, matchedWord: string|null, reason: string|null }>}
 */
const evaluateContent = async ({ title = '', content = '', communityId = null, communityDoc = null }) => {
  const combinedText = `${normalizeText(title)} ${normalizeText(content)}`.trim();

  if (!combinedText) {
    return { flagged: false, action: 'none', matchedRule: null, matchedWord: null, reason: null };
  }

  // 1. Check Global Rules
  for (const rule of GLOBAL_RULES) {
    for (const pattern of rule.patterns) {
      const match = combinedText.match(pattern);
      if (match) {
        return {
          flagged: true,
          action: 'quarantine',
          matchedRule: rule.ruleId,
          matchedWord: match[0],
          reason: rule.reason,
        };
      }
    }
  }

  // 2. Check Community-Specific Automod Keywords
  let comm = communityDoc;
  if (!comm && communityId) {
    try {
      comm = await Community.findById(communityId).select('automodKeywords automodEnabled slug name');
    } catch (err) {
      logger.warn('[Automod] Failed to fetch community for keyword check:', err.message);
    }
  }

  if (comm && comm.automodEnabled !== false && Array.isArray(comm.automodKeywords) && comm.automodKeywords.length > 0) {
    for (const rawKw of comm.automodKeywords) {
      const kw = (rawKw || '').trim().toLowerCase();
      if (!kw) continue;
      // Word boundary or substring regex
      const regex = new RegExp(`\\b${kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (regex.test(combinedText)) {
        return {
          flagged: true,
          action: 'quarantine',
          matchedRule: 'COMMUNITY_KEYWORD',
          matchedWord: kw,
          reason: `Violates custom community keyword filter: "${kw}"`,
        };
      }
    }
  }

  return { flagged: false, action: 'none', matchedRule: null, matchedWord: null, reason: null };
};

/**
 * Creates an automated Report for flagged content and returns the report
 */
const recordAutomodReport = async ({ targetType, targetId, communityId, evaluation }) => {
  try {
    const existing = await Report.findOne({
      targetType,
      targetId,
      status: 'pending',
    });

    if (existing) {
      // Already reported / pending review
      return existing;
    }

    const report = await Report.create({
      reporter: null,
      isAutomod: true,
      automodRule: evaluation.matchedRule,
      automodMatched: evaluation.matchedWord,
      targetType,
      targetId,
      community: communityId || null,
      reason: 'automod',
      description: `Automod flagged prohibited pattern "${evaluation.matchedWord}" under rule "${evaluation.matchedRule}". Quarantined for moderator triage.`,
      status: 'pending',
    });

    logger.info(`[Automod] Generated report ${report._id} for ${targetType}:${targetId} (rule: ${evaluation.matchedRule})`);
    return report;
  } catch (err) {
    logger.error('[Automod] Failed to create automod report:', err.message);
    return null;
  }
};

/**
 * Helper to check if a user is authorized to moderate a specific community
 */
const isUserCommunityModerator = async (community, userId, userRole) => {
  if (userRole === 'admin') return true;
  if (!community || !userId) return false;

  const uIdStr = userId.toString();

  // Check creator
  if (community.creator && community.creator.toString() === uIdStr) {
    return true;
  }

  // Check moderators array
  if (Array.isArray(community.moderators) && community.moderators.some((m) => m && m.toString() === uIdStr)) {
    return true;
  }

  // Check CommunityMember role
  const member = await CommunityMember.findOne({
    community: community._id,
    user: userId,
  }).lean();

  if (member && (member.role === 'moderator' || member.role === 'owner')) {
    return true;
  }

  return false;
};

module.exports = {
  GLOBAL_RULES,
  evaluateContent,
  recordAutomodReport,
  isUserCommunityModerator,
};
