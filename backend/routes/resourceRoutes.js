const express = require('express');
const router = express.Router();
const resourceController = require('../controllers/resourceController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');

router
  .route('/')
  .get(optionalAuth, resourceController.getResources)
  .post(protect, resourceController.createResource);

router
  .route('/:id')
  .get(optionalAuth, resourceController.getResourceById)
  .delete(protect, resourceController.deleteResource);

router.post('/:id/download', optionalAuth, resourceController.downloadResource);
router.post('/:id/vote', protect, resourceController.voteResource);

module.exports = router;
