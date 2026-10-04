const express = require('express');
const router = express.Router();
const studyGroupController = require('../controllers/studyGroupController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');

router
  .route('/')
  .get(optionalAuth, studyGroupController.getStudyGroups)
  .post(protect, studyGroupController.createStudyGroup);

router
  .route('/:id')
  .get(optionalAuth, studyGroupController.getStudyGroupById)
  .delete(protect, studyGroupController.deleteStudyGroup);

router.post('/:id/join', protect, studyGroupController.joinStudyGroup);
router.post('/:id/leave', protect, studyGroupController.leaveStudyGroup);

module.exports = router;
