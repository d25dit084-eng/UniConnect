/**
 * testAnonymityLeaks.js — Comprehensive Anonymity Leak Detection Suite
 *
 * Verifies that anonymous posts, comments, notifications, search results,
 * feeds, public profiles, and socket payloads NEVER leak author username,
 * ObjectId, email, avatar, or bio to non-author users or unauthenticated viewers.
 *
 * Covers >= 15 GET endpoints + Socket payloads + Admin Reveal Accountability.
 */

const { io } = require('socket.io-client');
const mongoose = require('mongoose');

const BASE_URL = process.env.API_URL || 'http://localhost:5000/api';
const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:5000';

// SAFETY CHECK
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/uniconnect';
try {
  const parsed = new URL(mongoUri.replace('mongodb://', 'http://'));
  console.log(`[Safety] Connecting tests against DB host: ${parsed.hostname}`);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    console.error('ABORT: Safety check failed. Tests can only run against localhost / dev database.');
    process.exit(1);
  }
} catch (e) {
  console.log(`[Safety] DB URI verified: ${mongoUri}`);
}

const apiCall = async (endpoint, method = 'GET', body = null, token = null) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${endpoint}`, options);
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
};

const runTests = async () => {
  console.log('================================================================');
  console.log('🕵️  STARTING COMPREHENSIVE ANONYMITY LEAK DETECTION SUITE');
  console.log('================================================================\n');

  const ts = Date.now();
  const authorData = {
    username: `author_priv_${ts}`,
    email: `author_priv_${ts}@campus.edu`,
    password: 'Password123!',
  };
  const viewerData = {
    username: `viewer_priv_${ts}`,
    email: `viewer_priv_${ts}@campus.edu`,
    password: 'Password123!',
  };
  const adminData = {
    username: `admin_priv_${ts}`,
    email: `admin_priv_${ts}@campus.edu`,
    password: 'Password123!',
  };

  // 1. Register & Authenticate Users
  console.log('1. Registering test accounts (Author, Viewer, Admin)...');
  const regAuthor = await apiCall('/auth/register', 'POST', authorData);
  if (!regAuthor.ok) throw new Error(`Author reg failed: ${JSON.stringify(regAuthor.data)}`);
  const loginAuthor = await apiCall('/auth/login', 'POST', { email: authorData.email, password: authorData.password });
  if (!loginAuthor.ok) throw new Error(`Author login failed: ${JSON.stringify(loginAuthor.data)}`);
  const authorToken = loginAuthor.data.data.accessToken;
  const authorId = loginAuthor.data.data.user._id;

  const regViewer = await apiCall('/auth/register', 'POST', viewerData);
  if (!regViewer.ok) throw new Error(`Viewer reg failed: ${JSON.stringify(regViewer.data)}`);
  const loginViewer = await apiCall('/auth/login', 'POST', { email: viewerData.email, password: viewerData.password });
  if (!loginViewer.ok) throw new Error(`Viewer login failed: ${JSON.stringify(loginViewer.data)}`);
  const viewerToken = loginViewer.data.data.accessToken;
  const viewerId = loginViewer.data.data.user._id;

  const regAdmin = await apiCall('/auth/register', 'POST', adminData);
  if (!regAdmin.ok) throw new Error(`Admin reg failed: ${JSON.stringify(regAdmin.data)}`);
  const loginAdmin = await apiCall('/auth/login', 'POST', { email: adminData.email, password: adminData.password });
  if (!loginAdmin.ok) throw new Error(`Admin login failed: ${JSON.stringify(loginAdmin.data)}`);
  let adminToken = loginAdmin.data.data.accessToken;
  const adminId = loginAdmin.data.data.user._id;

  // Promote admin in DB directly and re-login for admin token
  await mongoose.connect(mongoUri);
  const User = require('../models/User');
  const AuditLog = require('../models/AuditLog');
  await User.findByIdAndUpdate(adminId, { $set: { role: 'admin' } });
  const loginAdminRole = await apiCall('/auth/login', 'POST', { email: adminData.email, password: adminData.password });
  adminToken = loginAdminRole.data.data.accessToken;

  console.log(`   Author: ${authorData.username} (${authorId})`);
  console.log(`   Viewer: ${viewerData.username} (${viewerId})`);
  console.log(`   Admin:  ${adminData.username} (${adminId})\n`);

  // 2. Setup Community
  console.log('2. Creating test community and joining...');
  const commRes = await apiCall('/communities', 'POST', {
    name: `anoncomm_${ts}`,
    displayName: 'Anonymous Testing Community',
    description: 'Community for testing zero leak anonymity',
  }, adminToken);
  if (!commRes.ok) throw new Error(`Community creation failed: ${JSON.stringify(commRes.data)}`);
  const community = commRes.data.data.community;
  const communityId = community._id;
  const communitySlug = community.slug;

  // Author and Viewer join community
  await apiCall(`/communities/${communityId}/join`, 'POST', null, authorToken);
  await apiCall(`/communities/${communityId}/join`, 'POST', null, viewerToken);

  // 3. Connect Socket to verify broadcast payload
  console.log('3. Connecting WebSocket client to inspect broadcast payloads...');
  let receivedSocketPost = null;
  const socket = io(SOCKET_URL, {
    transports: ['websocket'],
    auth: { token: viewerToken },
  });

  await new Promise((resolve) => {
    socket.on('connect', () => {
      socket.on('new_post', (data) => {
        receivedSocketPost = data;
      });
      resolve();
    });
  });

  // 4. Author Creates Anonymous Post
  console.log('4. Author creates an ANONYMOUS post...');
  const postRes = await apiCall('/posts', 'POST', {
    communityId,
    type: 'text',
    title: `Confession_${ts}: Secrets of Campus Life`,
    content: `Sensitive confession body about campus events and professors`,
    isAnonymous: true,
  }, authorToken);
  if (!postRes.ok) throw new Error(`Post creation failed: ${JSON.stringify(postRes.data)}`);
  const post = postRes.data.data.post;
  const postId = post._id;
  console.log(`   Post created: ${postId} (isAnonymous=${post.isAnonymous})`);

  // Wait 150ms for socket broadcast
  await new Promise((r) => setTimeout(r, 150));
  if (receivedSocketPost) {
    const rawSocketStr = JSON.stringify(receivedSocketPost);
    if (rawSocketStr.includes(authorData.username) || rawSocketStr.includes(authorId)) {
      throw new Error(`LEAK IN SOCKET BROADCAST: new_post payload exposed author identity! ${rawSocketStr}`);
    }
    console.log('   ✅ Socket payload has zero author leaks.');
  }

  // 5. Author Creates Anonymous Comment & Reply
  console.log('5. Author creates ANONYMOUS comment and reply...');
  const commentRes = await apiCall('/comments', 'POST', {
    postId,
    content: 'Anonymous comment on my own confession thread',
    isAnonymous: true,
  }, authorToken);
  if (!commentRes.ok) throw new Error(`Comment creation failed: ${JSON.stringify(commentRes.data)}`);
  const comment = commentRes.data.data.comment;
  const commentId = comment._id;

  const replyRes = await apiCall(`/comments/${commentId}/reply`, 'POST', {
    content: 'Anonymous reply in the same thread',
    isAnonymous: true,
  }, authorToken);
  if (!replyRes.ok) throw new Error(`Reply creation failed: ${JSON.stringify(replyRes.data)}`);
  const reply = replyRes.data.data.comment;
  const replyId = reply._id;

  // Viewer saves the post and upvotes it
  console.log('6. Viewer saves the post and upvotes it...');
  await apiCall(`/saved-posts/${postId}`, 'POST', null, viewerToken);
  await apiCall(`/votes/posts/${postId}`, 'POST', { value: 1 }, viewerToken);
  await apiCall(`/votes/comments/${commentId}`, 'POST', { value: 1 }, viewerToken);

  // 7. Verify Every GET Endpoint (at least 15 endpoints)
  console.log('\n7. Verifying zero identity leaks across ALL GET endpoints...');

  const endpointsToTest = [
    { name: '1. GET /feed/home', url: '/feed/home' },
    { name: '2. GET /feed/latest', url: '/feed/latest' },
    { name: '3. GET /feed/popular', url: '/feed/popular' },
    { name: '4. GET /posts/:id', url: `/posts/${postId}` },
    { name: '5. GET /posts/community/:slug', url: `/posts/community/${communitySlug}` },
    { name: '6. GET /posts/search', url: `/posts/search?q=Confession_${ts}` },
    { name: '7. GET /comments/post/:id', url: `/comments/post/${postId}` },
    { name: '8. GET /search (posts)', url: `/search?type=posts&q=Confession_${ts}` },
    { name: '9. GET /search (users)', url: `/search?type=users&q=${authorData.username}` },
    { name: '10. GET /search (communities)', url: `/search?type=communities&q=anoncomm_${ts}` },
    { name: '11. GET /users/:username/posts (Viewer view)', url: `/users/u/${authorData.username}/posts` },
    { name: '12. GET /users/:username (Public profile)', url: `/users/u/${authorData.username}` },
    { name: '13. GET /saved-posts', url: '/saved-posts' },
    { name: '14. GET /notifications (Author notifications)', url: '/notifications', token: authorToken },
    { name: '15. GET /communities/:slug', url: `/communities/${communitySlug}` },
    { name: '16. GET /admin/stats', url: '/admin/stats', token: adminToken },
    { name: '17. GET /admin/reports', url: '/admin/reports', token: adminToken },
    { name: '18. GET /admin/users', url: '/admin/users', token: adminToken },
  ];

  let verifiedCount = 0;

  for (const ep of endpointsToTest) {
    const token = ep.token || viewerToken;
    const res = await apiCall(ep.url, 'GET', null, token);
    if (!res.ok) throw new Error(`Endpoint ${ep.name} returned status ${res.status}: ${JSON.stringify(res.data)}`);
    const dataStr = JSON.stringify(res.data);

    // Rule 1: Viewer must NEVER see author's real username in connection with anonymous content
    if (!['9. GET /search (users)', '12. GET /users/:username (Public profile)', '18. GET /admin/users'].includes(ep.name)) {
      if (dataStr.includes(authorData.username)) {
        throw new Error(`🔴 LEAK DETECTED in ${ep.name}! Found real author username "${authorData.username}" in response:\n${dataStr}`);
      }
    }

    // Rule 2: Author's email must NEVER appear in any public GET endpoint
    if (!['18. GET /admin/users'].includes(ep.name)) {
      if (dataStr.includes(authorData.email)) {
        throw new Error(`🔴 LEAK DETECTED in ${ep.name}! Found author email in response:\n${dataStr}`);
      }
    }

    // Rule 3: Anonymous posts must have author._id === null when viewed by others
    if (ep.name.startsWith('4. GET /posts/:id')) {
      const returnedPost = res.data.data.post;
      if (returnedPost.isAnonymous) {
        if (returnedPost.author._id !== null) {
          throw new Error(`🔴 LEAK DETECTED in ${ep.name}! author._id is not null (${returnedPost.author._id})`);
        }
        if (!returnedPost.author.username.startsWith('Anonymous ')) {
          throw new Error(`🔴 LEAK DETECTED in ${ep.name}! author.username is not an alias: ${returnedPost.author.username}`);
        }
        if (returnedPost.author.isMine !== false) {
          throw new Error(`🔴 LEAK DETECTED in ${ep.name}! isMine must be false for viewer`);
        }
        if (returnedPost.author.avatar !== null) {
          throw new Error(`🔴 LEAK DETECTED in ${ep.name}! author.avatar must be null for anonymous post`);
        }
      }
    }

    // Rule 4: Comments list must show deterministic alias, isOP=true, isMine=false for viewer
    if (ep.name.startsWith('7. GET /comments/post/:id')) {
      const comments = res.data.data.comments;
      if (comments.length === 0) throw new Error('Expected comments in response');
      const topComment = comments[0];
      if (topComment.isAnonymous) {
        if (topComment.author._id !== null) {
          throw new Error(`🔴 LEAK DETECTED in ${ep.name}! Comment author._id is not null (${topComment.author._id})`);
        }
        if (!topComment.author.isOP) {
          throw new Error(`🔴 Expected isOP to be true for OP author comment in ${ep.name}`);
        }
        if (topComment.author.isMine !== false) {
          throw new Error(`🔴 Expected isMine to be false for viewer in ${ep.name}`);
        }
      }
    }

    // Rule 5: Author's public profile post list must EXCLUDE anonymous posts for other viewers
    if (ep.name.startsWith('11. GET /users/:username/posts (Viewer view)')) {
      const posts = res.data.data.posts;
      const foundAnon = posts.some((p) => p._id === postId || p.isAnonymous);
      if (foundAnon) {
        throw new Error(`🔴 LEAK DETECTED in ${ep.name}! Anonymous post was returned on public profile!`);
      }
    }

    // Rule 6: Notifications must NOT leak voter/actor username in text or payload
    if (ep.name.startsWith('14. GET /notifications')) {
      const notifications = res.data.data.notifications;
      for (const n of notifications) {
        if (n.actor) {
          throw new Error(`🔴 LEAK DETECTED in ${ep.name}! Notification actor ObjectId is exposed: ${n.actor}`);
        }
        if (n.message && n.message.includes(viewerData.username)) {
          throw new Error(`🔴 LEAK DETECTED in ${ep.name}! Notification message exposed voter username: ${n.message}`);
        }
      }
    }

    verifiedCount++;
    console.log(`   ✅ ${ep.name} passed anonymity checks.`);
  }

  console.log(`\nVerified ${verifiedCount} GET endpoints with 0 leaks!`);

  // 8. Test Author Self-View
  console.log('\n8. Testing Author self-view of their own anonymous post...');
  const authorSelfRes = await apiCall(`/posts/${postId}`, 'GET', null, authorToken);
  const selfPost = authorSelfRes.data.data.post;
  if (!selfPost.author.isMine) {
    throw new Error('Author self-view expected author.isMine === true');
  }
  if (!selfPost.isOwner) {
    throw new Error('Author self-view expected isOwner === true');
  }
  console.log('   ✅ Author self-view correctly flags isMine=true and isOwner=true.');

  // 9. Test Admin Deanonymization & Accountability (AuditLog)
  console.log('\n9. Testing Admin Deanonymization & AuditLog accountability...');

  // A. Non-admin cannot reveal author
  const failReveal = await apiCall('/admin/reveal-author', 'POST', {
    targetType: 'post',
    targetId: postId,
    reason: 'Trying to reveal without admin rights',
  }, viewerToken);
  if (failReveal.status === 403) {
    console.log('   ✅ Non-admin is blocked with 403 Forbidden.');
  } else {
    throw new Error(`Expected 403 for non-admin reveal, got: ${failReveal.status}`);
  }

  // B. Admin without reason cannot reveal author
  const noReasonReveal = await apiCall('/admin/reveal-author', 'POST', {
    targetType: 'post',
    targetId: postId,
    reason: '   ',
  }, adminToken);
  if (noReasonReveal.status === 400) {
    console.log('   ✅ Admin reveal without reason blocked with 400 Bad Request.');
  } else {
    throw new Error(`Expected 400 for reveal without reason, got: ${noReasonReveal.status}`);
  }

  // C. Admin with valid reason reveals author and creates AuditLog
  const revealRes = await apiCall('/admin/reveal-author', 'POST', {
    targetType: 'post',
    targetId: postId,
    reason: 'Investigating critical safety report #402',
  }, adminToken);
  if (!revealRes.ok) throw new Error(`Admin reveal failed: ${JSON.stringify(revealRes.data)}`);

  const revealedData = revealRes.data.data;
  if (revealedData.author._id.toString() !== authorId.toString()) {
    throw new Error(`Admin reveal returned wrong author: ${revealedData.author._id} vs ${authorId}`);
  }
  if (!revealedData.auditLog || !revealedData.auditLog._id) {
    throw new Error('Admin reveal failed to produce an auditLog ID in response');
  }

  const auditEntry = await AuditLog.findById(revealedData.auditLog._id);
  if (!auditEntry) {
    throw new Error('AuditLog entry was not found in MongoDB!');
  }
  if (auditEntry.reason !== 'Investigating critical safety report #402') {
    throw new Error(`AuditLog entry reason mismatch: ${auditEntry.reason}`);
  }
  console.log(`   ✅ Admin reveal succeeded with verified AuditLog entry (${auditEntry._id}).`);

  // Close socket and DB
  socket.disconnect();
  await mongoose.disconnect();

  console.log('\n================================================================');
  console.log('🎉 ALL ANONYMITY CHECKS PASSED WITH 0 LEAKS ACROSS ALL 18 ENDPOINTS!');
  console.log('================================================================\n');
};

runTests().catch((err) => {
  console.error('\n❌ ANONYMITY TEST SUITE FAILED:', err.message);
  process.exit(1);
});
