const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Course = require('../models/Course');
const StudyGroup = require('../models/StudyGroup');
const Conversation = require('../models/Conversation');
require('./setup');

describe('Study Groups Engine & Real-Time Chat Linkage', () => {
  let tokenA;
  let tokenB;
  let userA;
  let userB;
  let testCourse;
  let groupId;
  let conversationId;

  beforeAll(async () => {
    // Register User A
    const regA = await request(app).post('/api/auth/register').send({
      username: 'group_creator',
      email: 'creator@college.edu',
      password: 'Password@123',
    });
    userA = regA.body.data?.user;

    const loginA = await request(app).post('/api/auth/login').send({
      email: 'creator@college.edu',
      password: 'Password@123',
    });
    tokenA = loginA.body.data?.accessToken;

    // Register User B
    const regB = await request(app).post('/api/auth/register').send({
      username: 'group_member',
      email: 'member@college.edu',
      password: 'Password@123',
    });
    userB = regB.body.data?.user;

    const loginB = await request(app).post('/api/auth/login').send({
      email: 'member@college.edu',
      password: 'Password@123',
    });
    tokenB = loginB.body.data?.accessToken;

    testCourse = await Course.create({
      code: 'MATH201',
      name: 'Linear Algebra & Differential Equations',
      department: 'Mathematics',
      credits: 4,
    });
  });

  afterAll(async () => {
    if (userA) await User.findByIdAndDelete(userA._id || userA.id);
    if (userB) await User.findByIdAndDelete(userB._id || userB.id);
    if (testCourse) await Course.findByIdAndDelete(testCourse._id);
    if (groupId) await StudyGroup.findByIdAndDelete(groupId);
    if (conversationId) await Conversation.findByIdAndDelete(conversationId);
  });

  it('should create a study group and automatically initialize a linked group chat', async () => {
    const res = await request(app)
      .post('/api/study-groups')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'MATH201 Midterm Study Squad',
        description: 'Reviewing eigenvalues, matrix diagonalization and vector spaces.',
        courseCode: 'MATH201',
        topic: 'Midterm Exam Preparation',
        maxMembers: 3,
        meetingSchedule: 'Wednesdays at 4 PM',
        meetingType: 'hybrid',
        location: 'Math Building Room 102',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.group.name).toBe('MATH201 Midterm Study Squad');
    expect(res.body.group.courseCode).toBe('MATH201');
    expect(res.body.group.members.length).toBe(1);
    expect(res.body.group.members[0].role).toBe('admin');
    expect(res.body.group.conversation).toBeDefined();

    groupId = res.body.group._id;
    conversationId = res.body.group.conversation;

    // Verify conversation was created with creator as participant
    const conv = await Conversation.findById(conversationId);
    expect(conv).toBeDefined();
    expect(conv.participants.map((p) => p.toString())).toContain((userA._id || userA.id).toString());
  });

  it('should list study groups with courseCode filtering', async () => {
    const res = await request(app).get('/api/study-groups?courseCode=MATH201');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.groups)).toBe(true);
    expect(res.body.groups.length).toBeGreaterThanOrEqual(1);
    expect(res.body.groups[0].courseCode).toBe('MATH201');
  });

  it('should allow another user to join the study group and add them to the chat room', async () => {
    const joinRes = await request(app)
      .post(`/api/study-groups/${groupId}/join`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(joinRes.status).toBe(200);
    expect(joinRes.body.success).toBe(true);
    expect(joinRes.body.memberCount).toBe(2);

    // Verify User B is added to Conversation participants
    const conv = await Conversation.findById(conversationId);
    expect(conv.participants.map((p) => p.toString())).toContain((userB._id || userB.id).toString());
  });

  it('should reject duplicate join attempts by the same user', async () => {
    const dupRes = await request(app)
      .post(`/api/study-groups/${groupId}/join`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(dupRes.status).toBe(400);
    expect(dupRes.body.message).toContain('already a member');
  });

  it('should allow a member to leave the study group and remove them from the chat room', async () => {
    const leaveRes = await request(app)
      .post(`/api/study-groups/${groupId}/leave`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(leaveRes.status).toBe(200);
    expect(leaveRes.body.success).toBe(true);
    expect(leaveRes.body.memberCount).toBe(1);

    // Verify User B is removed from Conversation participants
    const conv = await Conversation.findById(conversationId);
    expect(conv.participants.map((p) => p.toString())).not.toContain((userB._id || userB.id).toString());
  });

  it('should reject deletion by non-admin and allow deletion by creator', async () => {
    // User B tries to delete -> 403
    const forbiddenRes = await request(app)
      .delete(`/api/study-groups/${groupId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(forbiddenRes.status).toBe(403);

    // Creator deletes -> 200
    const successRes = await request(app)
      .delete(`/api/study-groups/${groupId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(successRes.status).toBe(200);
    expect(successRes.body.success).toBe(true);
  });
});
