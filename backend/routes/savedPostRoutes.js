const express = require('express');
const router = express.Router();

const { savePost, unsavePost, getSavedPosts } = require('../controllers/savedPostController');
const { protect } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');

// All saved post endpoints require authentication
router.use(protect);

router.get('/', getSavedPosts);
router.post('/:postId', validateObjectId('postId'), savePost);
router.delete('/:postId', validateObjectId('postId'), unsavePost);

module.exports = router;
