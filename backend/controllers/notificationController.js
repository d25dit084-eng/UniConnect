const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const sendResponse = require('../utils/sendResponse');

// ─── Get Notifications ────────────────────────────────────────────────────────

const getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  let { page = 1, limit = 20, unread } = req.query;

  page = Math.max(1, parseInt(page, 10) || 1);
  limit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));

  const filter = { recipient: userId };
  if (unread === 'true') filter.isRead = false;

  const total = await Notification.countDocuments(filter);
  const notifications = await Notification.find(filter)
    .select('-actor -__v') // SECURITY: never expose actor ObjectId publicly
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const pages = Math.ceil(total / limit);

  sendResponse(res, 200, 'Notifications retrieved successfully', {
    notifications,
    pagination: {
      page,
      limit,
      total,
      pages,
      hasNext: page < pages,
      hasPrevious: page > 1,
    },
  });
});

// ─── Get Unread Count ─────────────────────────────────────────────────────────

const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({
    recipient: req.user._id,
    isRead: false,
  });

  sendResponse(res, 200, 'Unread notification count', { count });
});

// ─── Mark Single Notification as Read ────────────────────────────────────────

const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  // Users can only modify their own notifications
  if (notification.recipient.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized to modify this notification');
  }

  notification.isRead = true;
  await notification.save();

  sendResponse(res, 200, 'Notification marked as read');
});

// ─── Mark All as Read ─────────────────────────────────────────────────────────

const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { $set: { isRead: true } }
  );

  sendResponse(res, 200, 'All notifications marked as read');
});

// ─── Delete Notification ──────────────────────────────────────────────────────

const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  if (notification.recipient.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized to delete this notification');
  }

  await Notification.findByIdAndDelete(req.params.id);

  sendResponse(res, 200, 'Notification deleted');
});

// ─── Clear All Notifications ──────────────────────────────────────────────────

const clearAllNotifications = asyncHandler(async (req, res) => {
  await Notification.deleteMany({ recipient: req.user._id });
  sendResponse(res, 200, 'All notifications cleared');
});

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
};
