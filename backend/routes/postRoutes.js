const express = require('express');
const router = express.Router();

const {
  createPost,
  getPostById,
  updatePost,
  deletePost,
  searchPosts,
  getCommunityPosts,
  votePoll,
} = require('../controllers/postController');

const { protect, optionalAuth } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');
const validate = require('../middleware/validate');
const { createLimiter } = require('../middleware/rateLimiter');
const { createPostSchema } = require('../validations/postValidation');
const {
  validateCreatePost,
  validateUpdatePost,
  validatePaginationQuery,
  validateSearchQuery,
} = require('../validators/postValidator');

// Specific paths before parameterized
router.get('/search', validateSearchQuery, validatePaginationQuery, optionalAuth, searchPosts);
router.get('/community/:slug', optionalAuth, getCommunityPosts);

// Core POST
router.post('/', protect, createLimiter, validate(createPostSchema), createPost);

// Parameterized last
router.post('/:id/poll/vote', protect, validateObjectId('id'), votePoll);
router.get('/:id', optionalAuth, validateObjectId('id'), getPostById);
router.put('/:id', protect, validateObjectId('id'), validateUpdatePost, updatePost);
router.delete('/:id', protect, validateObjectId('id'), deletePost);

module.exports = router;
