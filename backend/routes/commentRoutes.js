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
const validate = require('../middleware/validate');
const { createLimiter } = require('../middleware/rateLimiter');
const { createCommentSchema, replyCommentSchema } = require('../validations/commentValidation');
const {
  validateCreateComment,
  validateCreateReply,
  validateUpdateComment,
} = require('../validators/commentValidator');

router.post('/', protect, createLimiter, validate(createCommentSchema), createComment);
router.get('/post/:postId', optionalAuth, validateObjectId('postId'), getPostComments);
router.post('/:id/reply', protect, createLimiter, validateObjectId('id'), validate(replyCommentSchema), replyToComment);
router.put('/:id', protect, validateObjectId('id'), validateUpdateComment, updateComment);
router.delete('/:id', protect, validateObjectId('id'), deleteComment);

module.exports = router;
