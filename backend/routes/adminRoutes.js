const express = require('express');
const router = express.Router();

const {
  getStats,
  getReports,
  reviewReport,
  moderatePost,
  moderateComment,
  getUsers,
} = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const validateObjectId = require('../middleware/validateObjectId');

// ALL admin routes require: authentication + admin role
router.use(protect, authorize('admin'));

router.get('/stats', getStats);
router.get('/users', getUsers);
router.get('/reports', getReports);
router.patch('/reports/:id', validateObjectId(), reviewReport);
router.patch('/posts/:id/moderate', validateObjectId(), moderatePost);
router.patch('/comments/:id/moderate', validateObjectId(), moderateComment);

module.exports = router;
