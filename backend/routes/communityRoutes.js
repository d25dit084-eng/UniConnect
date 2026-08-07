const express = require('express');
const router = express.Router();

const {
  createCommunity,
  getCommunities,
  getCommunityBySlug,
  updateCommunity,
  deleteCommunity,
  joinCommunity,
  leaveCommunity,
  getJoinedCommunities,
  getCommunityMembers,
} = require('../controllers/communityController');

const { protect, optionalAuth } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');

// Specific paths must be declared before parameterized paths
router.get('/', optionalAuth, getCommunities);
router.post('/', protect, createCommunity);
router.get('/joined', protect, getJoinedCommunities);

router.get('/:slug', optionalAuth, getCommunityBySlug);
router.put('/:id', protect, validateObjectId(), updateCommunity);
router.delete('/:id', protect, validateObjectId(), deleteCommunity);

router.post('/:id/join', protect, validateObjectId(), joinCommunity);
router.delete('/:id/leave', protect, validateObjectId(), leaveCommunity);

router.get('/:slug/members', optionalAuth, getCommunityMembers);

module.exports = router;
