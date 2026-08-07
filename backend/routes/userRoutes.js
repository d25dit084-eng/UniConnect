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
} = require('../controllers/userController');

const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { uploadProfileImage: uploadMiddleware } = require('../middleware/uploadMiddleware');
const { validateUpdateProfile } = require('../validators/userValidator');

// Specific paths must be declared before parameterized paths
router.get('/profile', protect, getProfile);
router.get('/me', protect, getProfile); // /me alias
router.put('/profile', protect, validateUpdateProfile, updateProfile);

// Verification
router.post('/verify', protect, requestVerification);
router.post('/verify/confirm', protect, verifyEmail);

// Profile image upload
router.post('/profile/image', protect, uploadMiddleware, uploadProfileImage);

// Blocking
router.get('/blocked', protect, getBlockedUsers);
router.post('/:username/block', protect, blockUser);
router.delete('/:username/block', protect, unblockUser);

// Parameterized public queries last
router.get('/:username', optionalAuth, getPublicProfile);
router.get('/:username/posts', optionalAuth, getPublicPosts);

module.exports = router;
