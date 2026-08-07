const express = require('express');
const router = express.Router();

const {
  createComment,
  getPostComments,
  replyToComment,
  updateComment,
  deleteComment,
} = require('../controllers/commentController');

const { protect, optionalAuth } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');
const {
  validateCreateComment,
  validateCreateReply,
  validateUpdateComment,
} = require('../validators/commentValidator');

router.post('/', protect, validateCreateComment, createComment);
router.get('/post/:postId', optionalAuth, validateObjectId('postId'), getPostComments);
router.post('/:id/reply', protect, validateObjectId('id'), validateCreateReply, replyToComment);
router.put('/:id', protect, validateObjectId('id'), validateUpdateComment, updateComment);
router.delete('/:id', protect, validateObjectId('id'), deleteComment);

module.exports = router;
