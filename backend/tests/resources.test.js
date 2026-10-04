const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Course = require('../models/Course');
const Resource = require('../models/Resource');
require('./setup');

describe('Academic Resource Library Engine', () => {
  let tokenA;
  let tokenB;
  let userA;
  let userB;
  let testCourse;
  let publicResourceId;
  let anonResourceId;

  beforeAll(async () => {
    // Register User A
    const regA = await request(app).post('/api/auth/register').send({
      username: 'resource_user_a',
      email: 'resource_a@college.edu',
      password: 'Password@123',
    });
    userA = regA.body.data?.user;

    const loginA = await request(app).post('/api/auth/login').send({
      email: 'resource_a@college.edu',
      password: 'Password@123',
    });
    tokenA = loginA.body.data?.accessToken;

    // Register User B
    const regB = await request(app).post('/api/auth/register').send({
      username: 'resource_user_b',
      email: 'resource_b@college.edu',
      password: 'Password@123',
    });
    userB = regB.body.data?.user;

    const loginB = await request(app).post('/api/auth/login').send({
      email: 'resource_b@college.edu',
      password: 'Password@123',
    });
    tokenB = loginB.body.data?.accessToken;

    // Seed test course
    testCourse = await Course.create({
      code: 'CS201',
      name: 'Data Structures and Algorithms',
      department: 'Computer Science',
      credits: 4,
    });
  });

  afterAll(async () => {
    if (userA) await User.findByIdAndDelete(userA._id || userA.id);
    if (userB) await User.findByIdAndDelete(userB._id || userB.id);
    if (testCourse) await Course.findByIdAndDelete(testCourse._id);
    await Resource.deleteMany({ courseCode: 'CS201' });
  });

  it('should create a public study material resource with author profile', async () => {
    const res = await request(app)
      .post('/api/resources')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Complete Trees & Graphs Lecture Notes',
        description: 'Comprehensive study notes with diagrams and pseudocode for CS201.',
        courseCode: 'CS201',
        category: 'lecture_notes',
        semester: 'Fall 2025',
        fileUrl: 'https://example.com/resources/cs201_trees.pdf',
        fileName: 'cs201_trees.pdf',
        fileType: 'pdf',
        fileSize: 2048576,
        tags: ['trees', 'graphs', 'algorithms'],
        isAnonymous: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.resource.title).toBe('Complete Trees & Graphs Lecture Notes');
    expect(res.body.resource.courseCode).toBe('CS201');
    expect(res.body.resource.author).toBeDefined();
    expect(res.body.resource.author.username).toContain('resource_user_a');
    publicResourceId = res.body.resource._id;
  });

  it('should create an anonymous resource and assert zero author identity leaks', async () => {
    const res = await request(app)
      .post('/api/resources')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Fall 2024 Midterm Exam with Solutions',
        description: 'Past exam paper with full step-by-step solutions.',
        courseCode: 'CS201',
        category: 'past_exam',
        semester: 'Fall 2024',
        fileUrl: 'https://example.com/resources/midterm2024.pdf',
        fileName: 'midterm2024.pdf',
        fileType: 'pdf',
        fileSize: 1024000,
        tags: ['exam', 'midterm', 'solutions'],
        isAnonymous: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    anonResourceId = res.body.resource._id;

    // View as User B (third party viewer)
    const viewRes = await request(app)
      .get(`/api/resources/${anonResourceId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(viewRes.status).toBe(200);
    const author = viewRes.body.resource.author;
    expect(author.isAnonymous).toBe(true);
    expect(author.alias).toBeDefined();
    expect(author.alias).not.toBe('resource_user_a');
    expect(author.username).not.toBe('resource_user_a');
    expect(author.username).not.toBe('u/resource_user_a');
    expect(author.email).toBeUndefined();
    expect(author._id).toBeNull();
  });

  it('should list and filter resources by courseCode and category', async () => {
    const res = await request(app).get('/api/resources?courseCode=CS201&category=past_exam');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.resources)).toBe(true);
    expect(res.body.resources.length).toBeGreaterThanOrEqual(1);
    expect(res.body.resources[0].category).toBe('past_exam');
  });

  it('should track downloads atomically and increment downloadsCount', async () => {
    const initialRes = await request(app).get(`/api/resources/${publicResourceId}`);
    const initialDownloads = initialRes.body.resource.downloadsCount || 0;

    const downloadRes = await request(app).post(`/api/resources/${publicResourceId}/download`);
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.body.success).toBe(true);
    expect(downloadRes.body.downloadsCount).toBe(initialDownloads + 1);
    expect(downloadRes.body.fileUrl).toBe('https://example.com/resources/cs201_trees.pdf');
  });

  it('should allow upvoting a resource and increment upvotesCount', async () => {
    const voteRes = await request(app)
      .post(`/api/resources/${publicResourceId}/vote`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(voteRes.status).toBe(200);
    expect(voteRes.body.success).toBe(true);
    expect(voteRes.body.upvotesCount).toBe(1);
  });

  it('should reject non-author deletion and permit author deletion', async () => {
    // User B tries to delete User A's resource -> 403
    const forbiddenRes = await request(app)
      .delete(`/api/resources/${publicResourceId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(forbiddenRes.status).toBe(403);

    // User A deletes their own resource -> 200
    const successRes = await request(app)
      .delete(`/api/resources/${publicResourceId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(successRes.status).toBe(200);
    expect(successRes.body.success).toBe(true);
  });
});
