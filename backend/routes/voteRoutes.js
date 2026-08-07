const express = require('express');
const router = express.Router();

const { votePost, voteComment } = require('../controllers/voteController');
const { protect } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');

router.post('/posts/:postId', protect, validateObjectId('postId'), votePost);
router.post('/comments/:commentId', protect, validateObjectId('commentId'), voteComment);

module.exports = router;
