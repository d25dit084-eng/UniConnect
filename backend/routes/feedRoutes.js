const express = require('express');
const router = express.Router();

const { getHomeFeed, getLatestFeed, getPopularFeed } = require('../controllers/feedController');
const { optionalAuth } = require('../middleware/authMiddleware');

router.get('/home', optionalAuth, getHomeFeed);
router.get('/latest', optionalAuth, getLatestFeed);
router.get('/popular', optionalAuth, getPopularFeed);

module.exports = router;
