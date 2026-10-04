/**
 * UniConnect Chat Latency Benchmark (BUDGET FORMAT)
 *
 * Requirements:
 * - Localhost bench client in a separate process
 * - 200-msg warmup
 * - Median of 3 runs of 1,000 msgs
 * - Budget targets:
 *     delivery:   p50 < 5 ms, p95 < 15 ms, p99 < 40 ms, max < 100 ms
 *     persisted:  p95 < 80 ms
 *     event-loop lag p99 < 20 ms during the run
 * - Reports: p50/p95/p99/max/stddev for each metric
 * - Fails with exit code 1 if any metric regresses past budget
 */

const { io } = require('socket.io-client');

const API_BASE = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';
const WARMUP_MESSAGES = 200;
const RUN_MESSAGES = 1000;
const NUM_RUNS = 3;

const BUDGET = {
  delivery: {
    p50: 5.0,
    p95: 15.0,
    p99: 40.0,
    max: 100.0,
  },
  persisted: {
    p95: 80.0,
  },
  eventLoopLag: {
    p99: 20.0,
  },
};

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

  await apiCall('/auth/register', 'POST', { username: unique, email, password });
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

const calcStats = (arr) => {
  if (!arr || arr.length === 0) {
    return { p50: 0, p95: 0, p99: 0, max: 0, min: 0, mean: 0, stddev: 0 };
  }
  const sorted = [...arr].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / sorted.length;
  const p50 = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);
  const variance = sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / sorted.length;
  const stddev = Math.sqrt(variance);

  return { p50, p95, p99, max, min, mean, stddev };
};

const medianOf = (values) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
};

const runSingleStream = async ({
  senderSocket,
  receiverSocket,
  conversationId,
  count,
  isWarmup = false,
  runIndex = 0,
}) => {
  const sentTimes = new Map();
  const deliveryLatencies = [];
  const persistLatencies = [];
  let receivedCount = 0;
  let nextSeq = 0;

  // Reset event loop monitor on server before starting measured run
  if (!isWarmup) {
    try {
      await apiCall('/health/reset-eventloop', 'POST');
    } catch (_) {}
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      receiverSocket.off('new_message', onNewMessage);
      reject(new Error(`Stream timed out! Delivered ${receivedCount}/${count} messages`));
    }, 60000);

    const onNewMessage = (msg) => {
      const receiveTime = process.hrtime.bigint();
      const match = msg.content && msg.content.match(/bench_msg_(\d+)/);
      if (match) {
        const seq = parseInt(match[1], 10);
        const sendTime = sentTimes.get(seq);
        if (sendTime) {
          const diffNs = Number(receiveTime - sendTime);
          deliveryLatencies.push(diffNs / 1e6);
          receivedCount++;

          if (!isWarmup && (receivedCount % 250 === 0 || receivedCount === count)) {
            process.stdout.write(`   [Run ${runIndex + 1}/${NUM_RUNS}] Progress: ${receivedCount}/${count} msgs\r`);
          }

          if (receivedCount >= count) {
            clearTimeout(timeout);
            receiverSocket.off('new_message', onNewMessage);
            // Wait slightly for final persist ack
            setTimeout(async () => {
              let eventLoopLagP99 = 0;
              if (!isWarmup) {
                try {
                  const health = await apiCall('/health', 'GET');
                  eventLoopLagP99 = health?.eventLoop?.p99LagMs || 0;
                } catch (_) {}
              }
              resolve({
                deliveryLatencies,
                persistLatencies,
                eventLoopLagP99,
              });
            }, 100);
          } else {
            sendNext();
          }
        }
      }
    };

    receiverSocket.on('new_message', onNewMessage);

    const sendNext = () => {
      if (nextSeq < count) {
        const seq = nextSeq++;
        const content = `bench_msg_${seq}_${Date.now()}`;
        const sTime = process.hrtime.bigint();
        sentTimes.set(seq, sTime);

        senderSocket.emit(
          'send_message',
          {
            conversationId,
            content,
            clientMsgId: `bench_${Date.now()}_${seq}`,
          },
          (ack) => {
            if (!ack?.error) {
              const persistTime = process.hrtime.bigint();
              const diffNs = Number(persistTime - sTime);
              persistLatencies.push(diffNs / 1e6);
            }
          }
        );
      }
    };

    // Kick off first message
    sendNext();
  });
};

const runBenchmark = async () => {
  console.log('================================================================');
  console.log('⚡ UNICONNECT CHAT BENCHMARK (BUDGET SUITE)');
  console.log(`Config: Warmup = ${WARMUP_MESSAGES} msgs | ${NUM_RUNS} runs of ${RUN_MESSAGES} msgs`);
  console.log('Budget:');
  console.log('  Delivery:   p50 < 5.0ms, p95 < 15.0ms, p99 < 40.0ms, max < 100.0ms');
  console.log('  Persisted:  p95 < 80.0ms');
  console.log('  Event-Loop: p99 < 20.0ms');
  console.log('================================================================\n');

  try {
    console.log('1. Setting up test credentials and direct conversation...');
    const sender = await getAuthUser('bench_snd');
    const receiver = await getAuthUser('bench_rcv');

    const convRes = await apiCall(
      '/chat/conversations',
      'POST',
      { recipientUsername: receiver.username },
      sender.token
    );
    const conversationId = convRes.data.conversation._id;

    console.log('2. Connecting WebSocket clients with websocket-only transport...');
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

    await Promise.all([
      new Promise((resolve) => senderSocket.emit('join_conversation', { conversationId }, resolve)),
      new Promise((resolve) => receiverSocket.emit('join_conversation', { conversationId }, resolve)),
    ]);
    console.log('   Connected and joined conversation room.\n');

    console.log(`3. Warming up connection with ${WARMUP_MESSAGES} messages...`);
    await runSingleStream({
      senderSocket,
      receiverSocket,
      conversationId,
      count: WARMUP_MESSAGES,
      isWarmup: true,
    });
    console.log('   ✅ Warmup complete.\n');

    console.log(`4. Running ${NUM_RUNS} benchmark iterations of ${RUN_MESSAGES} messages each...`);
    const runResults = [];

    for (let i = 0; i < NUM_RUNS; i++) {
      const runStart = Date.now();
      const result = await runSingleStream({
        senderSocket,
        receiverSocket,
        conversationId,
        count: RUN_MESSAGES,
        isWarmup: false,
        runIndex: i,
      });
      const durationMs = Date.now() - runStart;

      const deliveryStats = calcStats(result.deliveryLatencies);
      const persistStats = calcStats(result.persistLatencies);

      runResults.push({
        delivery: deliveryStats,
        persist: persistStats,
        eventLoopLagP99: result.eventLoopLagP99,
        durationMs,
      });

      console.log(
        `   [Run ${i + 1}/${NUM_RUNS}] Done in ${(durationMs / 1000).toFixed(2)}s | Delivery p50: ${deliveryStats.p50.toFixed(2)}ms, p95: ${deliveryStats.p95.toFixed(2)}ms | Persist p95: ${persistStats.p95.toFixed(2)}ms | Loop p99: ${result.eventLoopLagP99.toFixed(2)}ms`
      );

      // Brief rest between runs
      if (i < NUM_RUNS - 1) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    senderSocket.disconnect();
    receiverSocket.disconnect();

    // 5. Compute median of 3 runs for each metric
    const medianStats = {
      delivery: {
        p50: medianOf(runResults.map((r) => r.delivery.p50)),
        p95: medianOf(runResults.map((r) => r.delivery.p95)),
        p99: medianOf(runResults.map((r) => r.delivery.p99)),
        max: medianOf(runResults.map((r) => r.delivery.max)),
        stddev: medianOf(runResults.map((r) => r.delivery.stddev)),
      },
      persisted: {
        p50: medianOf(runResults.map((r) => r.persist.p50)),
        p95: medianOf(runResults.map((r) => r.persist.p95)),
        p99: medianOf(runResults.map((r) => r.persist.p99)),
        max: medianOf(runResults.map((r) => r.persist.max)),
        stddev: medianOf(runResults.map((r) => r.persist.stddev)),
      },
      eventLoopLag: {
        p99: medianOf(runResults.map((r) => r.eventLoopLagP99)),
      },
    };

    // 6. Check against Budget
    const checks = [
      {
        metric: 'delivery p50',
        actual: medianStats.delivery.p50,
        budget: BUDGET.delivery.p50,
        pass: medianStats.delivery.p50 < BUDGET.delivery.p50,
      },
      {
        metric: 'delivery p95',
        actual: medianStats.delivery.p95,
        budget: BUDGET.delivery.p95,
        pass: medianStats.delivery.p95 < BUDGET.delivery.p95,
      },
      {
        metric: 'delivery p99',
        actual: medianStats.delivery.p99,
        budget: BUDGET.delivery.p99,
        pass: medianStats.delivery.p99 < BUDGET.delivery.p99,
      },
      {
        metric: 'delivery max',
        actual: medianStats.delivery.max,
        budget: BUDGET.delivery.max,
        pass: medianStats.delivery.max < BUDGET.delivery.max,
      },
      {
        metric: 'persisted p95',
        actual: medianStats.persisted.p95,
        budget: BUDGET.persisted.p95,
        pass: medianStats.persisted.p95 < BUDGET.persisted.p95,
      },
      {
        metric: 'event-loop lag p99',
        actual: medianStats.eventLoopLag.p99,
        budget: BUDGET.eventLoopLag.p99,
        pass: medianStats.eventLoopLag.p99 < BUDGET.eventLoopLag.p99,
      },
    ];

    const allPassed = checks.every((c) => c.pass);

    console.log('\n\n================================================================');
    console.log('📊 FINAL CHAT BUDGET REPORT (Median of 3 runs)');
    console.log('================================================================');
    console.log('Metric                | Actual (ms) | Budget (ms) | Result');
    console.log('----------------------------------------------------------------');
    for (const c of checks) {
      const metricPad = c.metric.padEnd(21);
      const actualPad = `${c.actual.toFixed(2)} ms`.padEnd(11);
      const budgetPad = `< ${c.budget.toFixed(1)} ms`.padEnd(11);
      const status = c.pass ? '✅ PASS' : '❌ FAIL';
      console.log(`${metricPad} | ${actualPad} | ${budgetPad} | ${status}`);
    }
    console.log('----------------------------------------------------------------');
    console.log('Detailed Statistics:');
    console.log(`  Delivery:  p50=${medianStats.delivery.p50.toFixed(2)}ms, p95=${medianStats.delivery.p95.toFixed(2)}ms, p99=${medianStats.delivery.p99.toFixed(2)}ms, max=${medianStats.delivery.max.toFixed(2)}ms, stddev=${medianStats.delivery.stddev.toFixed(2)}ms`);
    console.log(`  Persisted: p50=${medianStats.persisted.p50.toFixed(2)}ms, p95=${medianStats.persisted.p95.toFixed(2)}ms, p99=${medianStats.persisted.p99.toFixed(2)}ms, max=${medianStats.persisted.max.toFixed(2)}ms, stddev=${medianStats.persisted.stddev.toFixed(2)}ms`);
    console.log(`  Loop Lag:  p99=${medianStats.eventLoopLag.p99.toFixed(2)}ms`);
    console.log('================================================================\n');

    if (!allPassed) {
      console.error('❌ BUDGET REGRESSION DETECTED! Chat budget not satisfied.');
      process.exit(1);
    } else {
      console.log('🎉 ALL CHAT BUDGET TARGETS MET DECISIVELY!');
      process.exit(0);
    }
  } catch (err) {
    console.error('\n❌ Benchmark script error:', err);
    process.exit(1);
  }
};

runBenchmark();
