/**
 * UniConnect Chat Latency Benchmark
 *
 * Measures sender-to-receiver delivery latency over WebSockets.
 * Opens 2 socket clients, creates a direct conversation, sends 1,000 messages,
 * and computes p50, p95, and p99 delivery latency.
 *
 * Run with: node scripts/chat-bench.js
 */

const { io } = require('socket.io-client');

const API_BASE = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';
const NUM_MESSAGES = 1000;
const CONCURRENCY = 10; // in-flight message concurrency

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

const getAuthUser = async (rolePrefix) => {
  const unique = `${rolePrefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const email = `${unique}@college.edu`;
  const password = 'Password@123';

  // Register
  await apiCall('/auth/register', 'POST', {
    username: unique,
    email,
    password,
  });

  // Login
  const loginRes = await apiCall('/auth/login', 'POST', { email, password });
  return {
    userId: loginRes.data.user._id,
    username: loginRes.data.user.username,
    token: loginRes.data.accessToken,
  };
};

const percentile = (arr, p) => {
  if (arr.length === 0) return 0;
  const index = Math.ceil((p / 100) * arr.length) - 1;
  return arr[Math.max(0, Math.min(index, arr.length - 1))];
};

const runBenchmark = async () => {
  console.log('================================================================');
  console.log('⚡ UNICONNECT CHAT LATENCY BENCHMARK');
  console.log(`Target: ${NUM_MESSAGES} messages | In-flight concurrency: ${CONCURRENCY}`);
  console.log('================================================================\n');

  try {
    console.log('1. Authenticating test clients...');
    const sender = await getAuthUser('bench_snd');
    const receiver = await getAuthUser('bench_rcv');
    console.log(`   Sender: ${sender.username}`);
    console.log(`   Receiver: ${receiver.username}`);

    console.log('2. Setting up 1-on-1 direct conversation...');
    const convRes = await apiCall('/chat/conversations', 'POST', {
      recipientUsername: receiver.username,
    }, sender.token);
    const conversationId = convRes.data.conversation._id;
    console.log(`   Conversation ID: ${conversationId}`);

    console.log('3. Connecting WebSocket clients...');
    const senderSocket = io(SOCKET_URL, {
      auth: { token: sender.token, isBenchmark: true },
      transports: ['websocket'],
      reconnection: false,
    });

    const receiverSocket = io(SOCKET_URL, {
      auth: { token: receiver.token, isBenchmark: true },
      transports: ['websocket'],
      reconnection: false,
    });

    await Promise.all([
      new Promise((resolve, reject) => {
        senderSocket.on('connect', resolve);
        senderSocket.on('connect_error', reject);
      }),
      new Promise((resolve, reject) => {
        receiverSocket.on('connect', resolve);
        receiverSocket.on('connect_error', reject);
      }),
    ]);
    console.log('   Both sockets connected via WebSocket.');

    console.log('4. Joining conversation rooms...');
    senderSocket.on('error_message', (e) => console.error('   Sender error:', e));
    receiverSocket.on('error_message', (e) => console.error('   Receiver error:', e));
    senderSocket.on('rate_limit_exceeded', (e) => console.error('   Rate limit:', e));

    const [senderJoin, receiverJoin] = await Promise.all([
      new Promise((resolve) => senderSocket.emit('join_conversation', { conversationId }, resolve)),
      new Promise((resolve) => receiverSocket.emit('join_conversation', { conversationId }, resolve)),
    ]);
    console.log(`   Join results: sender=${JSON.stringify(senderJoin)}, receiver=${JSON.stringify(receiverJoin)}`);

    console.log(`5. Starting benchmark: streaming ${NUM_MESSAGES} messages...`);

    const sentTimes = new Map(); // msgSeq -> BigInt (nanoseconds)
    const latencies = []; // array of milliseconds (float)
    let receivedCount = 0;

    const completionPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Benchmark timed out! Received ${receivedCount}/${NUM_MESSAGES} messages`));
      }, 60000); // 60s timeout

      receiverSocket.on('new_message', (msg) => {
        const receiveTime = process.hrtime.bigint();
        const match = msg.content && msg.content.match(/bench_msg_(\d+)/);
        if (match) {
          const seq = parseInt(match[1], 10);
          const sendTime = sentTimes.get(seq);
          if (sendTime) {
            const diffNs = Number(receiveTime - sendTime);
            const diffMs = diffNs / 1e6; // convert to ms
            latencies.push(diffMs);
            receivedCount++;

            if (receivedCount % 200 === 0 || receivedCount === NUM_MESSAGES) {
              console.log(`   Progress: ${receivedCount}/${NUM_MESSAGES} messages delivered...`);
            }

            if (receivedCount >= NUM_MESSAGES) {
              clearTimeout(timeout);
              resolve();
            } else {
              // Send next message upon confirmation of delivery
              sendNext();
            }
          }
        }
      });
    });

    const benchStartTime = Date.now();
    let nextSeq = 0;

    const sendNext = () => {
      if (nextSeq < NUM_MESSAGES) {
        const seq = nextSeq++;
        const content = `bench_msg_${seq}_${Date.now()}`;
        sentTimes.set(seq, process.hrtime.bigint());
        senderSocket.emit('send_message', {
          conversationId,
          content,
          tempId: `tmp_${seq}`,
        }, (ack) => {
          if (ack?.error) {
            console.error(`   Message ${seq} error:`, ack.error);
          }
        });
      }
    };

    // Kick off first message
    sendNext();

    // Wait until all messages are round-tripped
    await completionPromise;
    const benchTotalTimeMs = Date.now() - benchStartTime;

    senderSocket.disconnect();
    receiverSocket.disconnect();

    latencies.sort((a, b) => a - b);

    const min = latencies[0].toFixed(2);
    const max = latencies[latencies.length - 1].toFixed(2);
    const sum = latencies.reduce((acc, v) => acc + v, 0);
    const avg = (sum / latencies.length).toFixed(2);
    const p50 = percentile(latencies, 50).toFixed(2);
    const p90 = percentile(latencies, 90).toFixed(2);
    const p95 = percentile(latencies, 95).toFixed(2);
    const p99 = percentile(latencies, 99).toFixed(2);
    const throughput = ((NUM_MESSAGES / benchTotalTimeMs) * 1000).toFixed(1);

    console.log('\n\n================================================================');
    console.log('📊 BENCHMARK RESULTS');
    console.log('================================================================');
    console.log(`Total messages sent & verified: ${latencies.length}`);
    console.log(`Total duration:                ${(benchTotalTimeMs / 1000).toFixed(2)} s`);
    console.log(`Throughput:                    ${throughput} msgs/sec`);
    console.log('----------------------------------------------------------------');
    console.log(`Latency (Min):                 ${min} ms`);
    console.log(`Latency (Avg):                 ${avg} ms`);
    console.log(`Latency (p50):                 ${p50} ms`);
    console.log(`Latency (p90):                 ${p90} ms`);
    console.log(`Latency (p95):                 ${p95} ms`);
    console.log(`Latency (p99):                 ${max} ms`);
    console.log('================================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Benchmark error:', err);
    process.exit(1);
  }
};

runBenchmark();
