const express = require('express');
const router = express.Router();

const {
  createConversation,
  getConversations,
  getMessages,
  sendMessage,
  readMessage,
  deleteMessage,
} = require('../controllers/chatController');

const { protect } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');

router.post('/conversations', protect, createConversation);
router.get('/conversations', protect, getConversations);
router.get('/conversations/:id/messages', protect, validateObjectId('id'), getMessages);
router.post('/conversations/:id/messages', protect, validateObjectId('id'), sendMessage);
router.patch('/messages/:id/read', protect, validateObjectId('id'), readMessage);
router.delete('/messages/:id', protect, validateObjectId('id'), deleteMessage);

module.exports = router;
