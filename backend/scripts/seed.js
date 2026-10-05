/**
 * UniConnect Comprehensive Idempotent Campus Seed Script
 *
 * Populates realistic college communities, demo students/faculty/admins,
 * posts (standard & anonymous), threaded comments, DMs, and notifications.
 *
 * Usage:
 *   node scripts/seed.js           # Idempotent (adds missing records, no data loss)
 *   node scripts/seed.js --fresh   # Clean reset and re-seed (dev only)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Community = require('../models/Community');
const CommunityMember = require('../models/CommunityMember');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Vote = require('../models/Vote');
const SavedPost = require('../models/SavedPost');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Block = require('../models/Block');
const Report = require('../models/Report');
const Notification = require('../models/Notification');
const RefreshToken = require('../models/RefreshToken');
const { calculateHotRank } = require('../services/rankingService');
const { encryptAuthor } = require('../utils/encryption');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/uniconnect';

// ─── Safety Guard ─────────────────────────────────────────────────────────────
const parsedUri = new URL(MONGO_URI.replace('mongodb://', 'http://').replace('mongodb+srv://', 'https://'));
const dbHost = parsedUri.hostname;
console.log(`🔒 [Safety Guard] Connecting to host: ${dbHost}`);

if (dbHost !== '127.0.0.1' && dbHost !== 'localhost' && !dbHost.includes('dev') && !process.argv.includes('--allow-atlas')) {
  console.error(`❌ [Safety Guard] Aborting: Database host "${dbHost}" is not localhost or a dev database! (Use --allow-atlas to seed your cloud cluster)`);
  process.exit(1);
}

const isFresh = process.argv.includes('--fresh') || process.argv.includes('--clean');

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Error: This script cannot be run in production!');
    process.exit(1);
  }

  console.log('🌱 Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected');

  if (isFresh) {
    console.log('🗑️ --fresh flag detected: Purging existing database data...');
    await Promise.all([
      User.deleteMany({}),
      Community.deleteMany({}),
      CommunityMember.deleteMany({}),
      Post.deleteMany({}),
      Comment.deleteMany({}),
      Vote.deleteMany({}),
      SavedPost.deleteMany({}),
      Conversation.deleteMany({}),
      Message.deleteMany({}),
      Block.deleteMany({}),
      Report.deleteMany({}),
      Notification.deleteMany({}),
      RefreshToken.deleteMany({}),
    ]);
    console.log('🗑️ Database purge complete');
  }

  // ─── 1. Demo Campus Users ──────────────────────────────────────────────────
  console.log('👥 Seeding Campus Users (idempotent)...');
  const usersData = [
    { username: 'quietfalcon', email: 'falcon@college.edu', password: 'Password@123', bio: 'Computer Science senior & open source enthusiast.', verified: true },
    { username: 'quietowl', email: 'owl@college.edu', password: 'Password@123', bio: 'AI researcher and late-night library dweller.', verified: true },
    { username: 'bytefox', email: 'fox@college.edu', password: 'Password@123', bio: 'Junior developer building distributed systems.', verified: true },
    { username: 'randompixel', email: 'pixel@college.edu', password: 'Password@123', bio: 'UI/UX designer and digital artist.', verified: true },
    { username: 'nightshift', email: 'shift@college.edu', password: 'Password@123', bio: 'Physics major, espresso lover, chess nerd.', verified: true },
    { username: 'voidwalker', email: 'void@college.edu', password: 'Password@123', bio: 'Varsity athlete, sports analytics debater.', verified: true },
    { username: 'campus_dean', email: 'dean@college.edu', password: 'Password@123', bio: 'Office of Student Affairs & Campus Life.', verified: true },
    { username: 'prof_turing', email: 'turing@college.edu', password: 'Password@123', bio: 'Department of Computer Science & Mathematics.', verified: true },
    { username: 'sysadm', email: 'admin@college.edu', password: 'Password@123', role: 'admin', bio: 'UniConnect Platform Administrator.', verified: true },
  ];

  const users = {};
  for (const u of usersData) {
    let userDoc = await User.findOne({ email: u.email });
    if (!userDoc) {
      userDoc = await User.create(u);
      console.log(`  + Created user: u/${u.username}`);
    } else {
      users[u.username] = userDoc;
    }
    users[u.username] = userDoc;
  }
  console.log(`✅ ${Object.keys(users).length} Users active`);

  // ─── 2. Campus Communities ─────────────────────────────────────────────────
  console.log('🏔️ Seeding Campus Communities (idempotent)...');
  const communitiesData = [
    {
      name: 'campus-life',
      slug: 'campus-life',
      displayName: 'Campus Life',
      description: 'The heartbeat of our university: campus news, events, dorm life, clubs, dining hall food, and daily campus experiences.',
      creator: users.campus_dean._id,
      rules: [
        { title: 'Be Welcoming', description: 'Treat fellow students and staff with respect.' },
        { title: 'Event Guidelines', description: 'Include date, time, and campus venue for event posts.' },
      ],
    },
    {
      name: 'cs-department',
      slug: 'cs-department',
      displayName: 'CS Department',
      description: 'Computer Science, coding discussions, algorithm challenges, lab assignments, and student hackathons.',
      creator: users.prof_turing._id,
      rules: [
        { title: 'No Honor Code Violations', description: 'Do not post full assignment solution code.' },
        { title: 'Format Code Blocks', description: 'Use markdown code fences for readability.' },
      ],
    },
    {
      name: 'career-advice',
      slug: 'career-advice',
      displayName: 'Career Advice',
      description: 'Internships, resume critiques, interview prep, career fairs, and advice from alumni and seniors.',
      creator: users.sysadm._id,
      rules: [
        { title: 'Anonymize Resumes', description: 'Remove personal phone numbers and home addresses from posted resumes.' },
      ],
    },
    {
      name: 'courses-professors',
      slug: 'courses-professors',
      displayName: 'Courses & Professors',
      description: 'Honest elective recommendations, syllabus advice, exam tips, and professor feedback.',
      creator: users.quietowl._id,
      rules: [
        { title: 'Constructive Feedback', description: 'Focus on curriculum and teaching style, not personal attacks.' },
      ],
    },
    {
      name: 'housing-roommates',
      slug: 'housing-roommates',
      displayName: 'Housing & Roommates',
      description: 'Subleases, apartment reviews near campus, roommate matching, and moving tips.',
      creator: users.bytefox._id,
      rules: [
        { title: 'Verified Listings', description: 'Specify rent range, utility costs, and lease terms.' },
      ],
    },
    {
      name: 'chaos',
      slug: 'chaos',
      displayName: 'Chaos',
      description: 'An open space for random shower thoughts, unexpected campus encounters, late-night memes, and spontaneous humor.',
      creator: users.quietowl._id,
      rules: [
        { title: 'Embrace Chaos', description: 'Post out-of-the-box observations.' },
        { title: 'No Harassment', description: 'Keep it lighthearted and safe for all.' },
      ],
    },
    {
      name: 'play-round',
      slug: 'play-round',
      displayName: 'Play-Round',
      description: 'Campus sports leagues, intramural games, Champions League debates, F1 race weekends, and fitness discussions.',
      creator: users.voidwalker._id,
      rules: [
        { title: 'Good Sportsmanship', description: 'Respect opposing teams and athletes.' },
      ],
    },
  ];

  const communities = {};
  for (const c of communitiesData) {
    let commDoc = await Community.findOne({ slug: c.slug });
    if (!commDoc) {
      commDoc = await Community.create({
        ...c,
        visibility: 'public',
        membersCount: Object.keys(users).length,
        postsCount: 0,
        moderators: [c.creator],
      });
      console.log(`  + Created community: c/${c.slug}`);
    }
    communities[c.slug] = commDoc;
  }
  console.log(`✅ ${Object.keys(communities).length} Communities active`);

  // ─── 3. Community Memberships ──────────────────────────────────────────────
  console.log('🤝 Ensuring Community Memberships...');
  for (const slug of Object.keys(communities)) {
    const commId = communities[slug]._id;
    for (const username of Object.keys(users)) {
      const userId = users[username]._id;
      const existing = await CommunityMember.findOne({ community: commId, user: userId });
      if (!existing) {
        await CommunityMember.create({
          community: commId,
          user: userId,
          role: communities[slug].creator.equals(userId) ? 'owner' : 'member',
        });
      }
    }
  }
  console.log('✅ Community memberships synchronized');

  // ─── 4. Campus Posts ───────────────────────────────────────────────────────
  console.log('📝 Seeding Campus Posts (Standard & Anonymous)...');
  const postsSeedData = [
    // cs-department
    {
      communitySlug: 'cs-department',
      author: 'quietfalcon',
      title: 'Guide: Setting up your local C++ dev environment for CS201 Algorithms',
      content: 'Here is the step-by-step setup using Clang, CMake, and VS Code debugger without pain:\n\n1. Install LLVM toolchain.\n2. Configure CMakePresets.json with AddressSanitizer enabled.\n3. Add launch.json for lldb.\n\nSaves hours during lab tests!',
      upvotes: 42,
      isAnonymous: false,
    },
    {
      communitySlug: 'cs-department',
      author: 'quietowl',
      title: 'Anyone preparing for summer SWE internships? Mock interview group starting next week',
      content: 'We are organizing peer mock interviews focusing on Data Structures, Graphs, and System Design basics. Open to juniors and sophomores. Drop a comment if interested!',
      upvotes: 35,
      isAnonymous: false,
    },
    {
      communitySlug: 'cs-department',
      author: 'bytefox',
      title: 'Honest confession: I still look up how to reverse a linked list before interviews',
      content: 'Three years of coding and every single technical round gives me the same momentary freeze. We are all humans here.',
      upvotes: 89,
      isAnonymous: true, // Anonymous post!
    },
    // campus-life
    {
      communitySlug: 'campus-life',
      author: 'campus_dean',
      title: 'Annual Spring Campus Hackathon & Innovation Showcase Announced!',
      content: 'Registration is officially open for the 2026 Spring Hackathon. Over $15,000 in project grants and mentorship from campus alumni founders.',
      upvotes: 95,
      isAnonymous: false,
    },
    {
      communitySlug: 'campus-life',
      author: 'randompixel',
      title: 'The North Dining Hall finally brought back the matcha soft serve machine',
      content: 'Nature is healing. Go before the 2 PM rush or the line wraps around the entire cafeteria courtyard.',
      upvotes: 68,
      isAnonymous: false,
    },
    {
      communitySlug: 'campus-life',
      author: 'nightshift',
      title: 'Which campus study spot has the absolute best silence and natural light?',
      content: 'The 4th floor science library stacks are unmatched on weekday afternoons. What are your secret hideouts?',
      upvotes: 27,
      isAnonymous: false,
    },
    // courses-professors
    {
      communitySlug: 'courses-professors',
      author: 'quietowl',
      title: 'Review: CS340 Operating Systems with Prof. Turing — What to Expect',
      content: 'One of the best but most demanding courses in the curriculum. The kernel project requires continuous work. Start labs early and master GDB before midterm!',
      upvotes: 54,
      isAnonymous: false,
    },
    {
      communitySlug: 'courses-professors',
      author: 'bytefox',
      title: 'Is taking Machine Learning and Computer Networks in the same semester manageable?',
      content: 'Looking at my course schedule for next term. Both have heavy programming assignments. Would love insights from anyone who took both simultaneously.',
      upvotes: 19,
      isAnonymous: true, // Anonymous post!
    },
    // career-advice
    {
      communitySlug: 'career-advice',
      author: 'quietfalcon',
      title: 'Resume Template that got me 6 interviews at top tech companies',
      content: 'Keep it single-page, strictly quantified impact (e.g. "Reduced query latency by 45% using Redis caching"), and remove high school achievements. Focus on shipped projects!',
      upvotes: 112,
      isAnonymous: false,
    },
    // housing-roommates
    {
      communitySlug: 'housing-roommates',
      author: 'nightshift',
      title: 'Sublet available: 1 BR in 2B2B modern apartment 5 mins walk from Engineering Quad',
      content: 'Available from June through August. In-unit washer/dryer, high-speed fiber internet included, gym in building. DM if looking for summer housing!',
      upvotes: 16,
      isAnonymous: false,
    },
    // chaos
    {
      communitySlug: 'chaos',
      author: 'randompixel',
      title: 'I made eye contact with a campus squirrel holding a whole slice of pizza',
      content: 'He looked at me, took another bite, and slowly backed up into the tree. Pure dominance asserted.',
      upvotes: 140,
      isAnonymous: true, // Anonymous post!
    },
    // play-round
    {
      communitySlug: 'play-round',
      author: 'voidwalker',
      title: 'Intramural Football Tournament quarterfinals schedule & predictions',
      content: 'Matches kick off this Saturday at 10 AM on the South Fields. CS Hackers vs Mechanical Dynamos is going to be the game of the season.',
      upvotes: 48,
      isAnonymous: false,
    },
  ];

  const seededPosts = [];
  for (let i = 0; i < postsSeedData.length; i++) {
    const pData = postsSeedData[i];
    const comm = communities[pData.communitySlug];
    const authorUser = users[pData.author];

    let post = await Post.findOne({ title: pData.title, community: comm._id });
    if (!post) {
      const createdAt = new Date(Date.now() - (postsSeedData.length - i) * 3600000 * 2);
      const score = pData.upvotes;
      const hotRank = calculateHotRank(score, 0, createdAt);

      post = await Post.create({
        author: authorUser._id,
        community: comm._id,
        type: 'text',
        title: pData.title,
        content: pData.content,
        upvoteCount: pData.upvotes,
        downvoteCount: 0,
        score,
        hotRank,
        commentCount: 0,
        isAnonymous: pData.isAnonymous,
        encryptedAuthor: pData.isAnonymous ? encryptAuthor(authorUser._id.toString()) : null,
        createdAt,
      });

      await Community.findByIdAndUpdate(comm._id, { $inc: { postsCount: 1 } });
      console.log(`  + Created post [${pData.isAnonymous ? 'Anon' : 'Public'}]: "${pData.title.slice(0, 40)}..."`);
    }
    seededPosts.push(post);
  }
  console.log(`✅ ${seededPosts.length} Posts active`);

  // ─── 5. Threaded Comments ──────────────────────────────────────────────────
  console.log('💬 Seeding Comments & Nested Replies...');
  for (const post of seededPosts) {
    const existingCommentsCount = await Comment.countDocuments({ post: post._id });
    if (existingCommentsCount === 0) {
      // Top-level comment
      const parentComment = await Comment.create({
        post: post._id,
        author: users.quietowl._id,
        parentComment: null,
        depth: 0,
        content: 'Super helpful post! Really appreciate you sharing this with the community.',
        upvoteCount: 4,
        score: 4,
        isAnonymous: false,
      });

      // Nested reply
      await Comment.create({
        post: post._id,
        author: users.bytefox._id,
        parentComment: parentComment._id,
        depth: 1,
        content: 'Echoing this. Bookmarked for reference!',
        upvoteCount: 2,
        score: 2,
        isAnonymous: post.isAnonymous, // Match anonymity
        encryptedAuthor: post.isAnonymous ? encryptAuthor(users.bytefox._id.toString()) : null,
      });

      await Post.findByIdAndUpdate(post._id, { $set: { commentCount: 2 } });
    }
  }
  console.log('✅ Comments seeded');

  // ─── 6. Sync User Karma ─────────────────────────────────────────────────────
  console.log('🗳️ Synchronizing User Karma...');
  for (const username of Object.keys(users)) {
    const user = users[username];
    const postUpvotes = await Post.aggregate([
      { $match: { author: user._id, isAnonymous: false } },
      { $group: { _id: null, total: { $sum: '$score' } } },
    ]);
    const commentUpvotes = await Comment.aggregate([
      { $match: { author: user._id, isAnonymous: false } },
      { $group: { _id: null, total: { $sum: '$score' } } },
    ]);

    const postKarma = (postUpvotes[0]?.total || 0) + 20;
    const commentKarma = (commentUpvotes[0]?.total || 0) + 10;
    user.karma = {
      post: postKarma,
      comment: commentKarma,
      total: postKarma + commentKarma,
    };
    await user.save();
  }
  console.log('✅ User karma synchronized');

  // ─── 7. Fictional Direct Messages ──────────────────────────────────────────
  console.log('💬 Ensuring Fictional Conversations...');
  const dmPartners = ['quietowl', 'bytefox', 'nightshift'];
  for (const partnerName of dmPartners) {
    const userA = users.quietfalcon;
    const userB = users[partnerName];

    let conv = await Conversation.findOne({
      participants: { $all: [userA._id, userB._id] },
    });

    if (!conv) {
      conv = await Conversation.create({
        participants: [userA._id, userB._id],
        lastMessageAt: new Date(Date.now() - 15 * 60 * 1000),
      });

      const msg = await Message.create({
        conversation: conv._id,
        sender: userB._id,
        content: `Hey @quietfalcon, are you working on the campus project today?`,
        createdAt: new Date(Date.now() - 15 * 60 * 1000),
      });

      conv.lastMessage = msg._id;
      await conv.save();
      console.log(`  + Created conversation between u/quietfalcon and u/${partnerName}`);
    }
  }
  console.log('✅ Direct conversations active');

  // ─── 8. Sample Notifications ───────────────────────────────────────────────
  console.log('🔔 Ensuring Sample Notifications...');
  const notifCount = await Notification.countDocuments({ recipient: users.quietfalcon._id });
  if (notifCount === 0) {
    const notifs = [
      {
        recipient: users.quietfalcon._id,
        message: 'u/quietowl replied to your comment: "Super helpful post!"',
        type: 'comment_reply',
        isRead: false,
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
      },
      {
        recipient: users.quietfalcon._id,
        message: 'Your post received 25 upvotes: "Guide: Setting up your local C++ dev environment"',
        type: 'post_vote',
        isRead: false,
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
      },
      {
        recipient: users.quietfalcon._id,
        message: 'Someone upvoted your anonymous post',
        type: 'post_vote',
        isRead: true,
        createdAt: new Date(Date.now() - 2 * 3600 * 1000),
      },
    ];
    await Notification.create(notifs);
    console.log('  + Seeded sample notifications for u/quietfalcon');
  }
  console.log('✅ Notifications active');

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 UniConnect Campus Data Seeding Complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Campus Communities:');
  console.log('  c/campus-life, c/cs-department, c/career-advice');
  console.log('  c/courses-professors, c/housing-roommates, c/chaos, c/play-round\n');
  console.log('Verified Test Accounts (Password: Password@123):');
  console.log('  • Student Lead:  u/quietfalcon  (falcon@college.edu)');
  console.log('  • Researcher:    u/quietowl     (owl@college.edu)');
  console.log('  • Faculty/Dean:  u/campus_dean  (dean@college.edu)');
  console.log('  • Professor:     u/prof_turing  (turing@college.edu)');
  console.log('  • Admin:         u/sysadm       (admin@college.edu)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await mongoose.disconnect();
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  });
