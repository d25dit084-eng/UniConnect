const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');

// ─── Course Endpoints ─────────────────────────────────────────────────────────
router.get('/courses', reviewController.getCourses);
router.post('/courses', protect, reviewController.createCourse);
router.get('/courses/:id', optionalAuth, reviewController.getCourseById);

// ─── Professor Endpoints ──────────────────────────────────────────────────────
router.get('/professors', reviewController.getProfessors);
router.post('/professors', protect, reviewController.createProfessor);
router.get('/professors/:id', optionalAuth, reviewController.getProfessorById);

// ─── Review Endpoints ─────────────────────────────────────────────────────────
router.post('/reviews', protect, reviewController.createReview);
router.post('/reviews/:id/vote', protect, reviewController.voteReview);

module.exports = router;
