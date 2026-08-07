/**
 * UniConnect Reddit Pivot Integration Test Script
 * Run with: node scripts/testRedditPivot.js
 */

const assert = require('assert').strict;

const apiCall = async (endpoint, method = 'GET', body = null, token = null) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`http://localhost:5000/api${endpoint}`, options);
  const data = await res.json();
  return { status: res.status, data };
};

const runTests = async () => {
  console.log('🧪 Starting Reddit Pivot End-to-End Tests...\n');

  try {
    // ─── 1. Auth Tests ──────────────────────────────────────────────────────────
    console.log('➡️ Testing User Registration & Login...');
    const emailA = `usera_${Date.now()}@college.edu`;
    const emailB = `userb_${Date.now()}@college.edu`;
    const emailC = `userc_${Date.now()}@college.edu`;

    const regA = await apiCall('/auth/register', 'POST', {
      username: `usera_${Date.now()}`,
      email: emailA,
      password: 'Password@123',
    });
    assert.equal(regA.status, 201);
    const userA_username = regA.data.data.user.username;

    const regB = await apiCall('/auth/register', 'POST', {
      username: `userb_${Date.now()}`,
      email: emailB,
      password: 'Password@123',
    });
    assert.equal(regB.status, 201);
    const userB_username = regB.data.data.user.username;

    const regC = await apiCall('/auth/register', 'POST', {
      username: `userc_${Date.now()}`,
      email: emailC,
      password: 'Password@123',
    });
    assert.equal(regC.status, 201);
    const userC_username = regC.data.data.user.username;

    // Logins
    const loginA = await apiCall('/auth/login', 'POST', { email: emailA, password: 'Password@123' });
    assert.equal(loginA.status, 200);
    const tokenA = loginA.data.data.accessToken;
    const userA_id = loginA.data.data.user._id;

    const loginB = await apiCall('/auth/login', 'POST', { email: emailB, password: 'Password@123' });
    assert.equal(loginB.status, 200);
    const tokenB = loginB.data.data.accessToken;
    const userB_id = loginB.data.data.user._id;

    const loginC = await apiCall('/auth/login', 'POST', { email: emailC, password: 'Password@123' });
    assert.equal(loginC.status, 200);
    const tokenC = loginC.data.data.accessToken;
    const userC_id = loginC.data.data.user._id;

    console.log('   ✅ Auth OK');

    // ─── 2. Community Creation & Membership ──────────────────────────────────────
    console.log('\n➡️ Testing Community Creation and Joins...');
    const commName = `programming_${Date.now()}`;
    const commCreate = await apiCall('/communities', 'POST', {
      name: commName,
      displayName: 'Programming Club',
      description: 'A club for developers and students.',
    }, tokenA);
    assert.equal(commCreate.status, 201);
    const communityId = commCreate.data.data.community._id;
    const communitySlug = commCreate.data.data.community.slug;

    // B Joins
    const joinB = await apiCall(`/communities/${communityId}/join`, 'POST', null, tokenB);
    assert.equal(joinB.status, 200);

    // C Joins
    const joinC = await apiCall(`/communities/${communityId}/join`, 'POST', null, tokenC);
    assert.equal(joinC.status, 200);

    // Verify Community members count
    const commGet = await apiCall(`/communities/${communitySlug}`, 'GET', null, tokenA);
    assert.equal(commGet.status, 200);
    assert.equal(commGet.data.data.community.membersCount, 3); // A (creator) + B + C
    console.log('   ✅ Community & Membership OK');

    // ─── 3. Post System ─────────────────────────────────────────────────────────
    console.log('\n➡️ Testing Post Creation...');
    const postCreate = await apiCall('/posts', 'POST', {
      communityId,
      type: 'text',
      title: 'How do you do recursion in javascript?',
      content: 'I need to write a subset generator but I am stuck on the stack structure.',
    }, tokenA);
    assert.equal(postCreate.status, 201);
    const postId = postCreate.data.data.post._id;

    // Verify score on creation (should be 1 because author upvotes automatically)
    assert.equal(postCreate.data.data.post.score, 1);
    console.log('   ✅ Post Creation OK');

    // ─── 4. Voting & Karma ──────────────────────────────────────────────────────
    console.log('\n➡️ Testing Post Upvotes / Downvotes / Karma sync...');
    
    // User B upvotes post (should increase score from 1 to 2)
    const voteB = await apiCall(`/votes/posts/${postId}`, 'POST', { value: 1 }, tokenB);
    assert.equal(voteB.status, 200);
    assert.equal(voteB.data.data.score, 2);

    // Verify User A post karma went up to 2 (1 self upvote + 1 B upvote)
    const getProfileA_1 = await apiCall('/users/me', 'GET', null, tokenA);
    assert.equal(getProfileA_1.status, 200);
    assert.equal(getProfileA_1.data.data.user.karma.post, 2);

    // User C downvotes post (should decrease score from 2 to 1)
    const voteC = await apiCall(`/votes/posts/${postId}`, 'POST', { value: -1 }, tokenC);
    assert.equal(voteC.status, 200);
    assert.equal(voteC.data.data.score, 1);

    // Verify User A post karma went back to 1
    const getProfileA_2 = await apiCall('/users/me', 'GET', null, tokenA);
    assert.equal(getProfileA_2.data.data.user.karma.post, 1);

    console.log('   ✅ Voting and Karma OK');

    // ─── 5. Nested Comments ─────────────────────────────────────────────────────
    console.log('\n➡️ Testing Threaded Comments...');
    // User B comments on A's post
    const commentCreate = await apiCall('/comments', 'POST', {
      postId,
      content: 'First top-level comment by user B',
    }, tokenB);
    assert.equal(commentCreate.status, 201);
    const commentId = commentCreate.data.data.comment._id;

    // User A replies to B's comment
    const reply1 = await apiCall(`/comments/${commentId}/reply`, 'POST', {
      content: 'A replies to B',
    }, tokenA);
    assert.equal(reply1.status, 201);
    const reply1Id = reply1.data.data.comment._id;

    // User C replies to A's reply
    const reply2 = await apiCall(`/comments/${reply1Id}/reply`, 'POST', {
      content: 'C replies to A',
    }, tokenC);
    assert.equal(reply2.status, 201);

    // Fetch comments tree and check nesting
    const commentsList = await apiCall(`/comments/post/${postId}`, 'GET', null, tokenA);
    assert.equal(commentsList.status, 200);
    assert.equal(commentsList.data.data.comments.length, 1); // 1 top-level comment
    assert.equal(commentsList.data.data.comments[0].replies.length, 1); // B has 1 reply from A
    assert.equal(commentsList.data.data.comments[0].replies[0].replies.length, 1); // A has 1 reply from C
    console.log('   ✅ Threaded Comments OK');

    // ─── 6. Saved Posts ──────────────────────────────────────────────────────────
    console.log('\n➡️ Testing Saved Posts (Private)...');
    const savePost = await apiCall(`/saved/${postId}`, 'POST', null, tokenB);
    assert.equal(savePost.status, 201);

    // Verify B's saved list has it
    const listB = await apiCall('/saved', 'GET', null, tokenB);
    assert.equal(listB.status, 200);
    assert.equal(listB.data.data.posts.length, 1);
    assert.equal(listB.data.data.posts[0]._id, postId);

    // Verify A's saved list does not have it
    const listA = await apiCall('/saved', 'GET', null, tokenA);
    assert.equal(listA.status, 200);
    assert.equal(listA.data.data.posts.length, 0);
    console.log('   ✅ Saved Posts OK');

    // ─── 7. Chat System ──────────────────────────────────────────────────────────
    console.log('\n➡️ Testing Chat Messaging & Privacy Boundaries...');
    // A creates DM conversation with B
    const createConv = await apiCall('/chat/conversations', 'POST', { recipientUsername: userB_username }, tokenA);
    assert.equal(createConv.status, 201);
    const convId = createConv.data.data.conversation._id;

    // A sends message to B
    const sendMsg = await apiCall(`/chat/conversations/${convId}/messages`, 'POST', {
      content: 'Hello boldbadger, this is usera!',
    }, tokenA);
    assert.equal(sendMsg.status, 201);

    // B fetches messages (Verify content)
    const getMsgsB = await apiCall(`/chat/conversations/${convId}/messages`, 'GET', null, tokenB);
    assert.equal(getMsgsB.status, 200);
    assert.equal(getMsgsB.data.data.messages.length, 1);
    assert.equal(getMsgsB.data.data.messages[0].content, 'Hello boldbadger, this is usera!');

    // C tries to fetch A-B conversation (Verify IDOR blocked: 403 Forbidden)
    const getMsgsC = await apiCall(`/chat/conversations/${convId}/messages`, 'GET', null, tokenC);
    assert.equal(getMsgsC.status, 403);
    console.log('   ✅ Chat & Privacy IDOR OK');

    // ─── 8. Moderator Privileges ─────────────────────────────────────────────────
    console.log('\n➡️ Testing Moderator Security Privileges (403 Forbidden)...');
    // User B attempts to edit c/programming metadata (restricted to A/owner/moderator)
    const editComm = await apiCall(`/communities/${communityId}`, 'PUT', {
      displayName: 'Hacked Club Display Name',
    }, tokenB);
    assert.equal(editComm.status, 403);
    console.log('   ✅ Moderator Access Checks OK');

    // ─── 9. User Anonymity Checking ──────────────────────────────────────────────
    console.log('\n➡️ Testing User Anonymity Response Validation...');
    const getPublicPost = await apiCall(`/posts/${postId}`, 'GET', null, tokenB);
    assert.equal(getPublicPost.status, 200);
    
    // Verify private properties are strictly hidden
    const authorObj = getPublicPost.data.data.post.author;
    assert.ok(authorObj.username.startsWith('u/'));
    assert.equal(authorObj.email, undefined);
    assert.equal(authorObj.role, undefined);
    assert.equal(authorObj.verified, undefined);
    console.log('   ✅ User Anonymity validation OK');

    console.log('\n🌟 ALL END-TO-END TESTS PASSED SUCCESSFULLY! 🌟');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  }
};

runTests();
