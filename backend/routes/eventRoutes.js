const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');

router
  .route('/')
  .get(optionalAuth, eventController.getEvents)
  .post(protect, eventController.createEvent);

router
  .route('/:id')
  .get(optionalAuth, eventController.getEventById)
  .delete(protect, eventController.deleteEvent);

router
  .route('/:id/rsvp')
  .post(protect, eventController.rsvpEvent)
  .delete(protect, eventController.cancelRsvp);

module.exports = router;
