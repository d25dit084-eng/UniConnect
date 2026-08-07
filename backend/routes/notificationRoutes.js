const express = require('express');
const router = express.Router();

const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');

// All notification endpoints require authentication
router.use(protect);

// IMPORTANT: specific routes before /:id
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);
router.delete('/clear-all', clearAllNotifications);

router.patch('/:id/read', validateObjectId(), markAsRead);
router.delete('/:id', validateObjectId(), deleteNotification);

module.exports = router;
