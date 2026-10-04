const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const { Event } = require('../models/Event');
const Notification = require('../models/Notification');
require('./setup');

describe('Campus Events & RSVP System', () => {
  let tokenA;
  let tokenB;
  let userA;
  let userB;
  let eventId;
  let cappedEventId;

  beforeAll(async () => {
    // Register User A (Organizer)
    const regA = await request(app).post('/api/auth/register').send({
      username: 'event_host',
      email: 'host@college.edu',
      password: 'Password@123',
    });
    userA = regA.body.data?.user;

    const loginA = await request(app).post('/api/auth/login').send({
      email: 'host@college.edu',
      password: 'Password@123',
    });
    tokenA = loginA.body.data?.accessToken;

    // Register User B (Attendee)
    const regB = await request(app).post('/api/auth/register').send({
      username: 'event_attendee',
      email: 'attendee@college.edu',
      password: 'Password@123',
    });
    userB = regB.body.data?.user;

    const loginB = await request(app).post('/api/auth/login').send({
      email: 'attendee@college.edu',
      password: 'Password@123',
    });
    tokenB = loginB.body.data?.accessToken;
  });

  afterAll(async () => {
    if (userA) await User.findByIdAndDelete(userA._id || userA.id);
    if (userB) await User.findByIdAndDelete(userB._id || userB.id);
    if (eventId) await Event.findByIdAndDelete(eventId);
    if (cappedEventId) await Event.findByIdAndDelete(cappedEventId);
    await Notification.deleteMany({ type: 'event_rsvp' });
  });

  test('POST /api/events - Creates a new event with organizer as first attendee', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 3); // 3 days from now
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Spring Hackathon 2026',
        description: 'Annual campus 24-hour hackathon with prizes and free food!',
        category: 'academic',
        format: 'hybrid',
        location: 'Engineering Building Hall B',
        virtualLink: 'https://meet.college.edu/hackathon',
        startDate: futureDate.toISOString(),
        capacity: 100,
        tags: ['hackathon', 'coding', 'tech'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.event.title).toBe('Spring Hackathon 2026');
    expect(res.body.event.category).toBe('academic');
    expect(res.body.event.format).toBe('hybrid');
    expect(res.body.event.attendeeCount).toBe(1);
    expect(res.body.event.userRsvpStatus).toBe('going');

    eventId = res.body.event._id;
  });

  test('GET /api/events - Returns upcoming events and respects filters', async () => {
    const res = await request(app)
      .get('/api/events?category=academic&format=hybrid')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.events)).toBe(true);
    expect(res.body.events.length).toBeGreaterThan(0);

    const found = res.body.events.find((e) => e._id === eventId);
    expect(found).toBeDefined();
    // User B has not RSVPed yet
    expect(found.userRsvpStatus).toBeNull();
  });

  test('GET /api/events/:id - Returns single event details', async () => {
    const res = await request(app).get(`/api/events/${eventId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.event._id).toBe(eventId);
    expect(res.body.event.organizer.username).toBe('event_host');
  });

  test('POST /api/events/:id/rsvp - User B RSVPs going and creates organizer notification', async () => {
    const res = await request(app)
      .post(`/api/events/${eventId}/rsvp`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ status: 'going' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.event.userRsvpStatus).toBe('going');
    expect(res.body.event.attendeeCount).toBe(2);

    // Verify notification was sent to User A
    const notif = await Notification.findOne({
      recipient: userA._id || userA.id,
      type: 'event_rsvp',
    });
    expect(notif).toBeDefined();
    expect(notif.message).toContain('RSVPed to your event');
  });

  test('POST /api/events/:id/rsvp - User B switches RSVP to maybe', async () => {
    const res = await request(app)
      .post(`/api/events/${eventId}/rsvp`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ status: 'maybe' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.event.userRsvpStatus).toBe('maybe');
    // attendeeCount only counts 'going', so it drops back to 1
    expect(res.body.event.attendeeCount).toBe(1);
  });

  test('Capacity enforcement - Rejects RSVP going when capacity is reached', async () => {
    // Create an event with capacity = 1 (host is attendee #1)
    const futureDate = new Date(Date.now() + 86400000 * 5);
    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Exclusive VIP Round Table',
        description: 'Limited seating seminar.',
        startDate: futureDate.toISOString(),
        capacity: 1,
      });

    cappedEventId = createRes.body.event._id;

    // User B tries to RSVP 'going' -> should fail due to capacity
    const rsvpRes = await request(app)
      .post(`/api/events/${cappedEventId}/rsvp`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ status: 'going' });

    expect(rsvpRes.status).toBe(400);
    expect(rsvpRes.body.success).toBe(false);
    expect(rsvpRes.body.message).toContain('capacity');
  });

  test('DELETE /api/events/:id/rsvp - Cancels RSVP', async () => {
    const res = await request(app)
      .delete(`/api/events/${eventId}/rsvp`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.event.userRsvpStatus).toBeNull();
  });

  test('DELETE /api/events/:id - Unauthorized non-organizer cannot delete', async () => {
    const res = await request(app)
      .delete(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('DELETE /api/events/:id - Organizer can delete event', async () => {
    const res = await request(app)
      .delete(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const check = await Event.findById(eventId);
    expect(check).toBeNull();
  });
});
