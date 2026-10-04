const { Event, EVENT_CATEGORIES, EVENT_FORMATS, RSVP_STATUSES } = require('../models/Event');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');

/**
 * Helper to determine viewer's RSVP status on an event doc
 */
const getViewerRsvpStatus = (eventDoc, viewerId) => {
  if (!viewerId || !eventDoc.attendees) return null;
  const match = eventDoc.attendees.find(
    (att) => att.user && att.user.toString() === viewerId.toString()
  );
  return match ? match.status : null;
};

/**
 * Format event doc for client response
 */
const formatEvent = (eventDoc, viewerId) => {
  const plain = eventDoc.toObject ? eventDoc.toObject() : { ...eventDoc };
  plain.userRsvpStatus = getViewerRsvpStatus(eventDoc, viewerId);
  return plain;
};

/**
 * @desc Get list of events with filters and pagination
 * @route GET /api/events
 * @access Public (Optional Auth for userRsvpStatus)
 */
const getEvents = async (req, res) => {
  try {
    const {
      category,
      format,
      search,
      timeframe = 'upcoming', // 'upcoming', 'past', 'all'
      myRsvps,
      organizer,
      page = 1,
      limit = 20,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    if (category && EVENT_CATEGORIES.includes(category)) {
      query.category = category;
    }

    if (format && EVENT_FORMATS.includes(format)) {
      query.format = format;
    }

    if (organizer) {
      query.organizer = organizer;
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ title: searchRegex }, { description: searchRegex }, { location: searchRegex }];
    }

    const now = new Date();
    if (timeframe === 'upcoming') {
      query.startDate = { $gte: now };
    } else if (timeframe === 'past') {
      query.startDate = { $lt: now };
    }

    if (myRsvps === 'true' && req.user) {
      query['attendees.user'] = req.user._id;
    }

    const sortOrder = timeframe === 'past' ? { startDate: -1 } : { startDate: 1 };

    const [events, total] = await Promise.all([
      Event.find(query)
        .populate('organizer', 'username avatar')
        .populate('community', 'name slug')
        .sort(sortOrder)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Event.countDocuments(query),
    ]);

    const viewerId = req.user ? req.user._id : null;
    const formattedEvents = events.map((ev) => {
      ev.userRsvpStatus = getViewerRsvpStatus(ev, viewerId);
      return ev;
    });

    return res.status(200).json({
      success: true,
      events: formattedEvents,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      totalEvents: total,
    });
  } catch (error) {
    logger.error('Error fetching events:', { error: error.message });
    return res.status(500).json({ success: false, message: 'Server error fetching events' });
  }
};

/**
 * @desc Get single event by ID
 * @route GET /api/events/:id
 * @access Public (Optional Auth)
 */
const getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findById(id)
      .populate('organizer', 'username avatar')
      .populate('community', 'name slug')
      .populate('attendees.user', 'username avatar');

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const viewerId = req.user ? req.user._id : null;
    return res.status(200).json({
      success: true,
      event: formatEvent(event, viewerId),
    });
  } catch (error) {
    logger.error('Error fetching event by ID:', { error: error.message });
    return res.status(500).json({ success: false, message: 'Server error fetching event details' });
  }
};

/**
 * @desc Create a new campus event
 * @route POST /api/events
 * @access Private
 */
const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      category = 'social',
      format = 'in_person',
      location = '',
      virtualLink = '',
      startDate,
      endDate,
      capacity = 0,
      tags = [],
      community = null,
      coverImage = '',
    } = req.body;

    if (!title || title.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Event title must be at least 3 characters',
      });
    }

    if (!description || description.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Event description is required',
      });
    }

    if (!startDate) {
      return res.status(400).json({
        success: false,
        message: 'Event start date is required',
      });
    }

    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid start date format',
      });
    }

    let end = null;
    if (endDate) {
      end = new Date(endDate);
      if (isNaN(end.getTime()) || end < start) {
        return res.status(400).json({
          success: false,
          message: 'End date must be after start date',
        });
      }
    }

    const cleanCapacity = Math.max(0, parseInt(capacity, 10) || 0);

    const event = new Event({
      title: title.trim(),
      description: description.trim(),
      organizer: req.user._id,
      community: community || null,
      category: EVENT_CATEGORIES.includes(category) ? category : 'social',
      format: EVENT_FORMATS.includes(format) ? format : 'in_person',
      location: location ? location.trim() : '',
      virtualLink: virtualLink ? virtualLink.trim() : '',
      startDate: start,
      endDate: end,
      capacity: cleanCapacity,
      tags: Array.isArray(tags) ? tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean) : [],
      coverImage: coverImage ? coverImage.trim() : '',
      attendees: [
        {
          user: req.user._id,
          status: 'going',
          registeredAt: new Date(),
        },
      ],
      attendeeCount: 1,
    });

    await event.save();
    await event.populate('organizer', 'username avatar');

    return res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event: formatEvent(event, req.user._id),
    });
  } catch (error) {
    logger.error('Error creating event:', { error: error.message });
    return res.status(500).json({ success: false, message: 'Server error creating event' });
  }
};

/**
 * @desc RSVP to an event (going, maybe, not_going)
 * @route POST /api/events/:id/rsvp
 * @access Private
 */
const rsvpEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { status = 'going' } = req.body;

    if (!RSVP_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${RSVP_STATUSES.join(', ')}`,
      });
    }

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const userIdStr = req.user._id.toString();
    const existingIndex = event.attendees.findIndex(
      (att) => att.user && att.user.toString() === userIdStr
    );

    // If new RSVP to 'going' or changing from maybe/not_going to going, check capacity
    if (status === 'going' && event.capacity > 0) {
      const isAlreadyGoing =
        existingIndex !== -1 && event.attendees[existingIndex].status === 'going';
      if (!isAlreadyGoing && event.attendeeCount >= event.capacity) {
        return res.status(400).json({
          success: false,
          message: 'Event has reached maximum capacity',
        });
      }
    }

    let isNewRsvp = false;
    if (existingIndex !== -1) {
      event.attendees[existingIndex].status = status;
      event.attendees[existingIndex].registeredAt = new Date();
    } else {
      isNewRsvp = true;
      event.attendees.push({
        user: req.user._id,
        status,
        registeredAt: new Date(),
      });
    }

    // Recalculate attendee count of 'going'
    event.attendeeCount = event.attendees.filter((att) => att.status === 'going').length;
    await event.save();

    // Trigger notification to organizer if non-organizer is going
    if (
      isNewRsvp &&
      status === 'going' &&
      event.organizer.toString() !== userIdStr
    ) {
      try {
        await Notification.create({
          recipient: event.organizer,
          actor: req.user._id,
          type: 'event_rsvp',
          event: event._id,
          message: `${req.user.username || 'A student'} RSVPed to your event "${event.title}"`,
        });
      } catch (notifErr) {
        logger.warn('Failed to send RSVP notification:', notifErr.message);
      }
    }

    await event.populate('organizer', 'username avatar');

    return res.status(200).json({
      success: true,
      message: `RSVP updated to ${status}`,
      event: formatEvent(event, req.user._id),
    });
  } catch (error) {
    logger.error('Error updating RSVP:', { error: error.message });
    return res.status(500).json({ success: false, message: 'Server error updating RSVP' });
  }
};

/**
 * @desc Cancel/Remove RSVP from an event
 * @route DELETE /api/events/:id/rsvp
 * @access Private
 */
const cancelRsvp = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const userIdStr = req.user._id.toString();
    const existingIndex = event.attendees.findIndex(
      (att) => att.user && att.user.toString() === userIdStr
    );

    if (existingIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'You have not RSVPed to this event',
      });
    }

    event.attendees.splice(existingIndex, 1);
    event.attendeeCount = event.attendees.filter((att) => att.status === 'going').length;
    await event.save();
    await event.populate('organizer', 'username avatar');

    return res.status(200).json({
      success: true,
      message: 'RSVP cancelled successfully',
      event: formatEvent(event, req.user._id),
    });
  } catch (error) {
    logger.error('Error cancelling RSVP:', { error: error.message });
    return res.status(500).json({ success: false, message: 'Server error cancelling RSVP' });
  }
};

/**
 * @desc Delete an event
 * @route DELETE /api/events/:id
 * @access Private (Organizer or Admin)
 */
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const isOrganizer = event.organizer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin' || req.user.isAdmin === true;

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only the event organizer or an admin can delete this event',
      });
    }

    await Event.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Event deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting event:', { error: error.message });
    return res.status(500).json({ success: false, message: 'Server error deleting event' });
  }
};

module.exports = {
  getEvents,
  getEventById,
  createEvent,
  rsvpEvent,
  cancelRsvp,
  deleteEvent,
};
