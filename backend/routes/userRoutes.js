const express = require('express');
const router = express.Router();

const {
  getProfile,
  getPublicProfile,
  getPublicPosts,
  updateProfile,
  blockUser,
  unblockUser,
  getBlockedUsers,
  requestVerification,
  verifyEmail,
  uploadProfileImage,
  autocompleteUsers,
  completeOnboarding,
} = require('../controllers/userController');

const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { uploadProfileImage: uploadMiddleware, validateUploadedImage } = require('../middleware/uploadMiddleware');
const { validateUpdateProfile } = require('../validators/userValidator');

// Specific paths must be declared before parameterized paths
router.get('/profile', protect, getProfile);
router.get('/me', protect, getProfile); // /me alias
router.put('/profile', protect, validateUpdateProfile, updateProfile);
router.post('/onboarding', protect, completeOnboarding);

// Verification
router.post('/verify', protect, requestVerification);
router.post('/verify/confirm', protect, verifyEmail);

// Profile image upload
router.post('/profile/image', protect, uploadMiddleware, validateUploadedImage, uploadProfileImage);

// Blocking
router.get('/blocked', protect, getBlockedUsers);
router.post('/:username/block', protect, blockUser);
router.delete('/:username/block', protect, unblockUser);
router.get('/autocomplete', optionalAuth, autocompleteUsers);

// Parameterized public queries
router.get('/u/:username/posts', optionalAuth, getPublicPosts);
router.get('/u/:username', optionalAuth, getPublicProfile);
router.get('/:username/posts', optionalAuth, getPublicPosts);
router.get('/:username', optionalAuth, getPublicProfile);

module.exports = router;
