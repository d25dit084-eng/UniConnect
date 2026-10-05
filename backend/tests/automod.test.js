const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Community = require('../models/Community');
const CommunityMember = require('../models/CommunityMember');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Report = require('../models/Report');
require('./setup');

describe('Automod & Moderation Reports Queue', () => {
  let modUser, modToken, modId;
  let regularUser, regularToken, regularId;
  let testCommunity;

  beforeAll(async () => {
    // 1. Register mod user
    const modReg = await request(app).post('/api/auth/register').send({
      username: 'comm_mod_user',
      email: 'commmod@college.edu',
      password: 'Password@123',
    });
    modId = modReg.body.data?.user?._id || modReg.body.data?.user?.id;
    const modLogin = await request(app).post('/api/auth/login').send({
      email: 'commmod@college.edu',
      password: 'Password@123',
    });
    modToken = modLogin.body.data?.accessToken;

    // 2. Register regular user
    const regRes = await request(app).post('/api/auth/register').send({
      username: 'regular_student_user',
      email: 'regularstudent@college.edu',
      password: 'Password@123',
    });
    regularId = regRes.body.data?.user?._id || regRes.body.data?.user?.id;
    const regLogin = await request(app).post('/api/auth/login').send({
      email: 'regularstudent@college.edu',
      password: 'Password@123',
    });
    regularToken = regLogin.body.data?.accessToken;

    // 3. Create community owned by modUser
    testCommunity = await Community.create({
      name: 'automod-test-community',
      displayName: 'Automod Test Community',
      slug: 'automod-test-community',
      description: 'Community for testing automod and moderation triage',
      creator: modId,
      moderators: [modId],
    });

    await CommunityMember.create({
      community: testCommunity._id,
      user: modId,
      role: 'owner',
    });

    await CommunityMember.create({
      community: testCommunity._id,
      user: regularId,
      role: 'member',
    });
  });

  afterAll(async () => {
    await User.deleteMany({ _id: { $in: [modId, regularId] } });
    if (testCommunity) {
      await Community.findByIdAndDelete(testCommunity._id);
      await CommunityMember.deleteMany({ community: testCommunity._id });
      await Post.deleteMany({ community: testCommunity._id });
      await Report.deleteMany({ community: testCommunity._id });
    }
  });

  test('Clean post is created with status: "active"', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${regularToken}`)
      .send({
        communityId: testCommunity._id,
        type: 'text',
        title: 'Looking for a study buddy for Algorithms',
        content: 'Anyone interested in forming a study group for midterms?',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.post.status).toBe('active');
  });

  test('Post containing prohibited keyword triggers automod quarantine and generates report', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${regularToken}`)
      .send({
        communityId: testCommunity._id,
        type: 'text',
        title: 'Free leaked exam answers available here',
        content: 'Contact me to get the exam leaks for tomorrow finals test.',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    // Post is quarantined
    expect(res.body.data.post.status).toBe('hidden');

    // Verify automod report was created
    const report = await Report.findOne({
      targetType: 'post',
      targetId: res.body.data.post._id,
      isAutomod: true,
    });

    expect(report).toBeTruthy();
    expect(report.status).toBe('pending');
    expect(report.automodRule).toBe('ACADEMIC_DISHONESTY');
    expect(report.reason).toBe('automod');
  });

  test('Comment containing spam keyword triggers quarantine and report', async () => {
    // Create an active post first
    const postDoc = await Post.create({
      author: modId,
      community: testCommunity._id,
      type: 'text',
      title: 'General Discussion Topic',
      content: 'Hello everyone!',
      status: 'active',
    });

    const res = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${regularToken}`)
      .send({
        postId: postDoc._id,
        content: 'Claim free crypto giveaway and airdrop claim at scam-link.xyz!',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.comment.status).toBe('hidden');

    const report = await Report.findOne({
      targetType: 'comment',
      targetId: res.body.data.comment._id,
      isAutomod: true,
    });

    expect(report).toBeTruthy();
    expect(report.automodRule).toBe('SCAMS_AND_PHISHING');
  });

  test('Community moderator can configure custom banned keywords', async () => {
    const res = await request(app)
      .put(`/api/communities/${testCommunity.slug}/mod/settings`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({
        automodKeywords: ['secretparty2026', 'ticketscalper'],
        automodEnabled: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.community.automodKeywords).toContain('secretparty2026');

    // Now regular user tries to post that keyword
    const postRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${regularToken}`)
      .send({
        communityId: testCommunity._id,
        type: 'text',
        title: 'Selling tickets for secretparty2026 event',
        content: 'DM me if you want secretparty2026 passes.',
      });

    expect(postRes.status).toBe(201);
    expect(postRes.body.data.post.status).toBe('hidden');

    const report = await Report.findOne({
      targetId: postRes.body.data.post._id,
      automodRule: 'COMMUNITY_KEYWORD',
    });
    expect(report).toBeTruthy();
  });

  test('Community moderator can view moderation reports queue and action report', async () => {
    // 1. Fetch reports
    const listRes = await request(app)
      .get(`/api/communities/${testCommunity.slug}/mod/reports`)
      .set('Authorization', `Bearer ${modToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.reports.length).toBeGreaterThan(0);

    const pendingReport = listRes.body.data.reports.find((r) => r.status === 'pending');
    expect(pendingReport).toBeTruthy();
    expect(pendingReport.targetPreview).toBeTruthy();

    // 2. Action report (approve/restore)
    const actionRes = await request(app)
      .post(`/api/communities/${testCommunity.slug}/mod/reports/${pendingReport._id}/action`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({
        action: 'approve',
        note: 'False positive, approved by mod',
      });

    expect(actionRes.status).toBe(200);
    expect(actionRes.body.success).toBe(true);
    expect(actionRes.body.data.report.status).toBe('dismissed');

    // Post should be unhidden
    const post = await Post.findById(pendingReport.targetId);
    if (post) {
      expect(post.status).toBe('active');
    }
  });

  test('Non-moderator is rejected from moderation reports with 403 Forbidden', async () => {
    const res = await request(app)
      .get(`/api/communities/${testCommunity.slug}/mod/reports`)
      .set('Authorization', `Bearer ${regularToken}`);

    expect(res.status).toBe(403);
  });
});
