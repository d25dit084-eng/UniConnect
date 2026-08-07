const express = require('express');
const router = express.Router();

const {
  createPost,
  getPostById,
  updatePost,
  deletePost,
  searchPosts,
} = require('../controllers/postController');

const { protect, optionalAuth } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');
const {
  validateCreatePost,
  validateUpdatePost,
  validatePaginationQuery,
  validateSearchQuery,
} = require('../validators/postValidator');

// Specific paths before parameterized
router.get('/search', validateSearchQuery, validatePaginationQuery, optionalAuth, searchPosts);

// Core POST
router.post('/', protect, validateCreatePost, createPost);

// Parameterized last
router.get('/:id', optionalAuth, validateObjectId('id'), getPostById);
router.put('/:id', protect, validateObjectId('id'), validateUpdatePost, updatePost);
router.delete('/:id', protect, validateObjectId('id'), deletePost);

module.exports = router;
