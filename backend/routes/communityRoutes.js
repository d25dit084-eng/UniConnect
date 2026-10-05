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

const {
  getCommunityModReports,
  actionCommunityModReport,
  getCommunityModSettings,
  updateCommunityModSettings,
} = require('../controllers/communityModController');

const { protect, optionalAuth } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');

// Specific paths must be declared before parameterized paths
router.get('/', optionalAuth, getCommunities);
router.post('/', protect, createCommunity);
router.get('/joined', protect, getJoinedCommunities);

// Community Moderation Endpoints
router.get('/:slug/mod/reports', protect, getCommunityModReports);
router.post('/:slug/mod/reports/:id/action', protect, validateObjectId('id'), actionCommunityModReport);
router.get('/:slug/mod/settings', protect, getCommunityModSettings);
router.put('/:slug/mod/settings', protect, updateCommunityModSettings);

router.get('/:slug', optionalAuth, getCommunityBySlug);
router.put('/:id', protect, validateObjectId(), updateCommunity);
router.delete('/:id', protect, validateObjectId(), deleteCommunity);

router.post('/:id/join', protect, validateObjectId(), joinCommunity);
router.delete('/:id/leave', protect, validateObjectId(), leaveCommunity);

router.get('/:slug/members', optionalAuth, getCommunityMembers);

module.exports = router;
