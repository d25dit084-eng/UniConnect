import api from './axios';

/**
 * Fetch campus events with filters and pagination
 */
export const getEvents = (params = {}) => api.get('/events', { params });

/**
 * Fetch single event details by ID
 */
export const getEventById = (id) => api.get(`/events/${id}`);

/**
 * Create a new campus event
 */
export const createEvent = (data) => api.post('/events', data);

/**
 * RSVP to an event (going, maybe, not_going)
 */
export const rsvpEvent = (id, status = 'going') =>
  api.post(`/events/${id}/rsvp`, { status });

/**
 * Cancel/withdraw RSVP from an event
 */
export const cancelRsvp = (id) => api.delete(`/events/${id}/rsvp`);

/**
 * Delete an event (organizer or admin)
 */
export const deleteEvent = (id) => api.delete(`/events/${id}`);
