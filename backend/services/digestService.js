const User = require('../models/User');
const Notification = require('../models/Notification');
const { Event } = require('../models/Event');
const { sendEmail } = require('./emailService');
const logger = require('../utils/logger');

/**
 * Compile a campus digest for a user
 * @param {string|ObjectId} userId
 */
const compileUserDigest = async (userId) => {
  const user = await User.findById(userId);
  if (!user || !user.email) return null;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h

  // Unread notifications
  const notifications = await Notification.find({
    recipient: userId,
    isRead: false,
    createdAt: { $gte: since },
  })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  // Upcoming campus events in next 7 days
  const now = new Date();
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const upcomingEvents = await Event.find({
    startDate: { $gte: now, $lte: nextWeek },
  })
    .sort({ startDate: 1 })
    .limit(3)
    .lean();

  return {
    user: {
      username: user.username,
      email: user.email,
    },
    unreadCount: notifications.length,
    notifications,
    upcomingEvents,
  };
};

/**
 * Send email digest to a user
 */
const sendUserDigestEmail = async (userId) => {
  try {
    const digest = await compileUserDigest(userId);
    if (!digest) return false;

    const notifLines =
      digest.notifications.length > 0
        ? digest.notifications.map((n) => `• ${n.message}`).join('\n')
        : '• No new notifications.';

    const eventLines =
      digest.upcomingEvents.length > 0
        ? digest.upcomingEvents
            .map(
              (e) =>
                `• ${e.title} (${new Date(e.startDate).toLocaleDateString()}) - ${e.location || 'Online'}`
            )
            .join('\n')
        : '• No upcoming events this week.';

    const textContent = `
Hello ${digest.user.username},

Here is your campus activity digest for today:

🔔 Recent Notifications:
${notifLines}

📅 Upcoming Campus Events:
${eventLines}

Stay connected with your campus on UniConnect!
`.trim();

    await sendEmail({
      to: digest.user.email,
      subject: `UniConnect Daily Campus Digest (${digest.unreadCount} updates)`,
      text: textContent,
    });

    return true;
  } catch (err) {
    logger.error('[DigestService] Failed to send digest:', { error: err.message });
    return false;
  }
};

module.exports = {
  compileUserDigest,
  sendUserDigestEmail,
};
