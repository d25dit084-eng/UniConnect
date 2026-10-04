/**
 * Test: Block User -> Next Send is Rejected
 *
 * Verifies that blocking a user immediately rejects their subsequent socket messages,
 * and unblocking them restores messaging capability.
 *
 * Run with: node scripts/testChatBlock.js
 */

const { io } = require('socket.io-client');

const API_BASE = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

const apiCall = async (endpoint, method = 'GET', body = null, token = null) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${data.message || JSON.stringify(data)}`);
  }
  return data;
};

const createTestUser = async (prefix) => {
  const unique = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const email = `${unique}@college.edu`;
  const password = 'Password@123';

  await apiCall('/auth/register', 'POST', { username: unique, email, password });
  const loginRes = await apiCall('/auth/login', 'POST', { email, password });

  return {
    userId: loginRes.data.user._id,
    username: loginRes.data.user.username,
    token: loginRes.data.accessToken,
  };
};

const runBlockTest = async () => {
  console.log('================================================================');
  console.log('🧪 TEST: Block User -> Next Socket Send Is Rejected');
  console.log('================================================================\n');

  try {
    console.log('1. Creating test users (Alice & Bob)...');
    const alice = await createTestUser('alice_block');
    const bob = await createTestUser('bob_block');
    console.log(`   Alice: ${alice.username}`);
    console.log(`   Bob:   ${bob.username}`);

    console.log('2. Starting direct conversation between Alice and Bob...');
    const convRes = await apiCall('/chat/conversations', 'POST', {
      recipientUsername: bob.username,
    }, alice.token);
    const conversationId = convRes.data.conversation._id;
    console.log(`   Conversation ID: ${conversationId}`);

    console.log('3. Connecting WebSocket clients...');
    const aliceSocket = io(SOCKET_URL, {
      auth: { token: alice.token },
      transports: ['websocket'],
    });

    const bobSocket = io(SOCKET_URL, {
      auth: { token: bob.token },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise((res) => aliceSocket.on('connect', res)),
      new Promise((res) => bobSocket.on('connect', res)),
    ]);
    console.log('   Both sockets connected.');

    // Join conversation room
    await Promise.all([
      new Promise((res) => aliceSocket.emit('join_conversation', { conversationId }, res)),
      new Promise((res) => bobSocket.emit('join_conversation', { conversationId }, res)),
    ]);
    console.log('   Joined conversation room.');

    console.log('4. Bob sends first message before block (should succeed)...');
    const msg1Res = await new Promise((resolve) => {
      bobSocket.emit('send_message', {
        conversationId,
        content: 'Hello Alice, before block!',
        clientMsgId: 'msg_before_block',
      }, resolve);
    });

    if (msg1Res?.error) {
      throw new Error(`Message before block failed unexpectedly: ${msg1Res.error}`);
    }
    console.log('   ✅ Message 1 succeeded before block.');

    console.log('5. Alice blocks Bob via API...');
    const rawBobUsername = bob.username.replace(/^u\//, '');
    await apiCall(`/users/${rawBobUsername}/block`, 'POST', null, alice.token);
    console.log('   ✅ Alice blocked Bob.');

    console.log('6. Bob attempts to send message 2 after being blocked (must be REJECTED)...');
    let rejectedError = null;

    const blockPromise = new Promise((resolve) => {
      bobSocket.once('error_message', (err) => {
        resolve({ error: err.message });
      });

      bobSocket.emit('send_message', {
        conversationId,
        content: 'Hello Alice, after block!',
        clientMsgId: 'msg_after_block',
      }, (ack) => {
        if (ack?.error) resolve(ack);
      });
    });

    const result = await blockPromise;
    console.log(`   Server response for blocked send:`, result);

    if (!result?.error || (!result.error.includes('Blocked') && !result.error.includes('block'))) {
      throw new Error(`Expected message to be rejected with block error, got: ${JSON.stringify(result)}`);
    }
    console.log('   ✅ Message 2 was REJECTED because Bob is blocked by Alice!');

    console.log('7. Alice unblocks Bob via API...');
    await apiCall(`/users/${rawBobUsername}/block`, 'DELETE', null, alice.token);
    console.log('   ✅ Alice unblocked Bob.');

    console.log('8. Bob attempts to send message 3 after unblock (should succeed)...');
    const msg3Res = await new Promise((resolve) => {
      bobSocket.emit('send_message', {
        conversationId,
        content: 'Hello Alice, after unblock!',
        clientMsgId: 'msg_after_unblock',
      }, resolve);
    });

    if (msg3Res?.error) {
      throw new Error(`Message after unblock failed unexpectedly: ${msg3Res.error}`);
    }
    console.log('   ✅ Message 3 succeeded after unblock.');

    aliceSocket.disconnect();
    bobSocket.disconnect();

    console.log('\n================================================================');
    console.log('🎉 ALL CHAT BLOCK TESTS PASSED SUCCESSFULLY!');
    console.log('================================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  }
};

runBlockTest();
