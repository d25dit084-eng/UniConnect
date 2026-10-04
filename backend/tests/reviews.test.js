const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Course = require('../models/Course');
const Professor = require('../models/Professor');
const Review = require('../models/Review');
require('./setup');

describe('Course & Professor Reviews Engine', () => {
  let tokenA;
  let tokenB;
  let userA;
  let userB;
  let testCourse;
  let testProfessor;

  beforeAll(async () => {
    // Register User A
    const regA = await request(app).post('/api/auth/register').send({
      username: 'review_user_a',
      email: 'review_a@college.edu',
      password: 'Password@123',
    });
    userA = regA.body.data?.user;

    const loginA = await request(app).post('/api/auth/login').send({
      email: 'review_a@college.edu',
      password: 'Password@123',
    });
    tokenA = loginA.body.data?.accessToken;

    // Register User B
    const regB = await request(app).post('/api/auth/register').send({
      username: 'review_user_b',
      email: 'review_b@college.edu',
      password: 'Password@123',
    });
    userB = regB.body.data?.user;

    const loginB = await request(app).post('/api/auth/login').send({
      email: 'review_b@college.edu',
      password: 'Password@123',
    });
    tokenB = loginB.body.data?.accessToken;

    // Create course & professor
    testCourse = await Course.create({
      code: 'CS450',
      name: 'Distributed Systems & Cloud Computing',
      department: 'Computer Science',
      credits: 4,
    });

    testProfessor = await Professor.create({
      name: 'Dr. Leslie Lamport',
      department: 'Computer Science',
      title: 'Distinguished Professor',
    });
  });

  afterAll(async () => {
    if (userA) await User.findByIdAndDelete(userA._id || userA.id);
    if (userB) await User.findByIdAndDelete(userB._id || userB.id);
    if (testCourse) await Course.findByIdAndDelete(testCourse._id);
    if (testProfessor) await Professor.findByIdAndDelete(testProfessor._id);
    await Review.deleteMany({
      $or: [{ course: testCourse._id }, { professor: testProfessor._id }],
    });
  });

  it('should list courses with department filtering', async () => {
    const res = await request(app).get('/api/courses?department=Computer%20Science');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.courses)).toBe(true);
    const found = res.body.courses.find((c) => c.code === 'CS450');
    expect(found).toBeDefined();
  });

  it('should create a public course review and update aggregate rating', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        targetType: 'course',
        courseId: testCourse._id,
        rating: 5,
        difficulty: 4,
        wouldTakeAgain: true,
        grade: 'A',
        content: 'Challenging coursework with excellent Raft consensus projects. Learned a ton!',
        isAnonymous: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.review.rating).toBe(5);
    expect(res.body.review.author.username).toContain('review_user_a');

    // Verify course aggregate updated
    const updatedCourse = await Course.findById(testCourse._id);
    expect(updatedCourse.avgRating).toBe(5);
    expect(updatedCourse.avgDifficulty).toBe(4);
    expect(updatedCourse.reviewsCount).toBe(1);
  });

  it('should reject duplicate review for same course by same user', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        targetType: 'course',
        courseId: testCourse._id,
        rating: 4,
        difficulty: 3,
        content: 'Trying to review twice should be rejected.',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should create an anonymous professor review with zero author identity leaks', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        targetType: 'professor',
        professorId: testProfessor._id,
        rating: 4,
        difficulty: 5,
        wouldTakeAgain: true,
        grade: 'B+',
        content: 'Incredibly knowledgeable professor. High expectations but very fair tests.',
        isAnonymous: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.review.isAnonymous).toBe(true);

    // Verify author details in response
    const author = res.body.review.author;
    expect(author.isAnonymous).toBe(true);
    expect(author.alias).toBeDefined();

    // Check professor details endpoint as third-party viewer (User A viewing Professor)
    const profRes = await request(app)
      .get(`/api/professors/${testProfessor._id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(profRes.status).toBe(200);
    expect(profRes.body.professor.avgRating).toBe(4);
    expect(profRes.body.professor.wouldTakeAgainPercent).toBe(100);

    const anonReview = profRes.body.reviews.find((r) => r.isAnonymous);
    expect(anonReview).toBeDefined();
    // Zero-leak check: third-party viewer cannot see real username or real id
    expect(anonReview.author.username).not.toBe('review_user_b');
    expect(anonReview.author.alias).toBeTruthy();
    expect(anonReview.author.alias).not.toContain('review_user_b');
    expect(anonReview.author._id).toBeNull();
  });

  it('should record helpful votes on a review', async () => {
    const review = await Review.findOne({ professor: testProfessor._id });

    const res = await request(app)
      .post(`/api/reviews/${review._id}/vote`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ voteType: 'helpful' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.helpfulCount).toBe(1);
  });
});
