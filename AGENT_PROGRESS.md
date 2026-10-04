# AGENT PROGRESS — UNICONNECT

---

## 1. Decisions & Metrics

- **Current Phase**: Backlog A — Chat Latency Optimization (COMPLETED)
- **Architecture**: Decoupled Monorepo (React 18 + Vite SPA, Node.js + Express 5 REST API + Socket.IO 4.8 WebSockets, MongoDB 6+ with Mongoose 9).
- **Core Constraints Respected**:
  - No new heavy frameworks added. Pure React + vanilla CSS preserved.
  - Zero changes to existing route contracts without backwards compatibility.
  - Anonymity is paramount: the API must never return author identity for anonymous posts/comments to non-admins.
- **Verification Baseline**:
  - Backend API Health: `http://localhost:5000/api/health` -> `{"server": "running", "database": "connected"}`
  - Frontend Build: `npm run build` passed cleanly in 1.25s (0 warnings, 0 errors).
  - E2E Integration Test: `testRedditPivot.js` passed all 9 stages.
- **Chat Latency Benchmark (1,000 messages via `backend/scripts/chat-bench.js`)**:
  - **Baseline (Before Optimization)**:
    - Min: 1109.18 ms
    - Avg: 1241.65 ms
    - p50: 1252.12 ms
    - p90: 1327.56 ms
    - p95: 1344.25 ms
    - p99: 1358.89 ms
  - **Optimized (After Optimization)**:
    - Min: 1.37 ms
    - Avg: 2.20 ms
    - **p50: 2.04 ms** (vs 1252.12 ms baseline, ~613x speedup)
    - p90: 2.99 ms
    - **p95: 3.30 ms** (Target: < 50 ms — **EXCEEDED TARGET BY 15.1x**)
    - **p99: 6.05 ms** (vs 1358.89 ms baseline, ~224x speedup)
    - Throughput: **451.1 messages / sec** round-trip verified
  - **Target Outcome**: Server-side p95 delivery < 50 ms met decisively with 3.30 ms.
- **Multi-Instance Scaling & Redis Limitations (Q0.6)**:
  - `connectionStateRecovery` relies on persistent offset tracking; it does **not** work with the classic Redis adapter (`@socket.io/redis-adapter` pub/sub), which lacks stream persistence. For multi-instance deployments, either Redis Streams adapter (`@socket.io/redis-streams-adapter`) or Mongo-backed recovery must be used.
  - In-memory hot caches (`userCache`, `blockCache`, `conversationCache`, `userRateLimits`) require Redis pub/sub invalidation channels when running multiple Node server instances so that cache writes on one instance immediately evict corresponding keys on all other instances.

---

## 2. Done Log

- [x] Initialized project dev environment (Backend running on port 5000 with MongoDB, Frontend running on Vite port 5173).
- [x] Verified database connectivity to `mongodb://127.0.0.1:27017/uniconnect`.
- [x] Created quick-access project briefs (`PROJECT_BRIEF.txt`, `PROJECT_BRIEF.md`, `PROJECT_BRIEF_PAD.html`).
- [x] **Phase 0 Audit**: Thorough code review across all 13 models, 13 controllers, routes, middleware, services, helpers, and frontend components.
- [x] Dropped legacy stale unique index `token_1` from MongoDB `refreshtokens` collection; added unique `{ tokenHash: 1 }` index in `RefreshToken.js`.
- [x] **BACKLOG A — CHAT LATENCY OPTIMIZATION COMPLETED**:
  - [x] 1. Transport: `transports: ["websocket"]` only, `perMessageDeflate: false`, tuned `pingInterval: 25000` / `pingTimeout: 20000`, enabled `connectionStateRecovery`.
  - [x] 2. Relay first, persist second: `send_message` validates minimally, emits `new_message` to room immediately, then writes asynchronously to MongoDB with retry queue and fallback error ack. Client UUID `clientMsgId` used for idempotency and deduplication.
  - [x] 3. Optimistic UI: sender sees message instantly with state transitions `sending -> sent -> delivered -> read` via socket acks, delivery events, and read receipts. Failed messages show retry button with retry action.
  - [x] 4. In-memory hot cache (`userCache`, `blockCache`, `conversationCache`) for zero-DB hits on hot send path. Automatic invalidation hooks on change.
  - [x] 5. Presence and typing indicators in memory only; typing throttled to 2s on client, auto-expires on server after 4s.
  - [x] 6. Batch read receipts (`batch_message_read`) with `lastReadMessageId` debounced by 300ms.
  - [x] 7. DB indexes: compound `{ conversation: 1, createdAt: -1 }`, `{ conversation: 1, isRead: 1 }`, `{ clientMsgId: 1 }`. Field projections + `.lean()`. Cursor pagination (`before=<id>`). Atomic denormalized `Conversation.lastMessage` updates.
  - [x] 8. Scale path: added `@socket.io/redis-adapter` configuration behind `REDIS_URL` env variable with automatic fallback to in-memory adapter.
  - [x] 9. Frontend: windowed/virtualized message list, single socket context instance, preloads conversation list and message history from localStorage cache for instant render while network refreshes in background.
  - [x] 10. Resilience: client offline queue that flushes upon reconnect, exponential backoff reconnection (1s -> 5s), undelivered indicators.
  - [x] 11. Rate limit per socket (20 msgs / 10s) and message character cap (2,000 chars); blocked senders rejected server-side.
  - [x] Benchmark script created at `backend/scripts/chat-bench.js` sending 1,000 round-trip messages across 2 socket clients. p95 delivery measured at **3.30 ms**.
  - [x] E2E integration test suite (`testRedditPivot.js`) verified with all 9 phases passing.
- [x] **Backlog A Hardening & Refinements**:
  - [x] (a) Relay-first to recipient with sender's "sent" ack delivered strictly after MongoDB write succeeds. Graceful shutdown flushes persist queue on SIGTERM / SIGINT.
  - [x] (b) Cleared `uniconnect_cached_msgs_*` and `uniconnect_cached_convs_*` from `localStorage` on logout and whenever the logged-in `userId` changes.
  - [x] (c) Per-user rate limiting (by `userId` instead of socket ID). Added `disconnectUserSockets` to immediately terminate banned users' active sockets. Created automated test (`testChatBlock.js`) verifying blocked users cannot send socket messages.
  - [x] (d) `chat-bench.js` enhanced to report both Delivery Latency (sender to receiver relay) and Time-to-Persisted (sender to MongoDB write ack).
- [x] **Q0.1 — Message Idempotency Partial Unique Index**:
  - Added unique compound index `{ sender: 1, clientMsgId: 1 }` with `partialFilterExpression: { clientMsgId: { $type: "string" } }` to `Message` model.
  - Handled duplicate-key error (Mongo code 11000) in `persistMessageAsync` idempotently as a success acknowledgment. Synced DB indexes.
- [x] **Q0.2 — Bounded LRU & TTL Sweeps on Hot Caches**:
  - Implemented `BoundedLRUMap` with hard max sizes and TTLs: `userCache` (5,000, 15m), `blockCache` (5,000, 15m), `conversationCache` (2,000, 15m), `userRateLimits` (10,000), `processedClientMsgs` (20,000, 5m). Periodic active sweep every 60s. Removed unbounded Maps.
- [x] **Q0.3 — Independent Conversation.lastMessage Retries**:
  - Decoupled `Conversation.lastMessage` update from `Message.create` with its own 3-attempt exponential retry loop. Logged failures with conversation ID.
- [x] **Q0.4 — Dual Participant message_failed Notification**:
  - Emitted `message_failed` to conversation room so recipient drops speculative bubbles while sender marks failed for retry.
- [x] **Q0.5 — Unified Relay & DB Timestamp**:
  - Created single Date instance in `send_message`, passed to socket relay broadcast payload, `Message.create` (`createdAt: msgDate`), and `Conversation.lastMessageAt`.
- [x] **Q0.6 — Multi-Instance Scaling Documentation**:
  - Recorded architectural note on `connectionStateRecovery` incompatibility with classic Redis adapter and requirement for pub/sub cache invalidation.
- [x] **Phase 2.1 — Schema & Idempotent Migration**:
  - [x] Added `isAnonymous` (Boolean, default `false`) to `Post` schema with compound index `{ author: 1, isAnonymous: 1 }`.
  - [x] Added `isAnonymous` (Boolean, default `false`) to `Comment` schema with compound index `{ author: 1, isAnonymous: 1 }`.
  - [x] Created and executed idempotent migration script `backend/scripts/migrateAnonymity.js` ensuring all existing docs have `isAnonymous: false` and indexes are synchronized.
- [x] **Phase 2.2-2.7 — Q1 Phase 2 Anonymity Engine (Zero-Leak Anonymity Engine)**:
  - [x] 1.2 Centralized Author Serializer (`backend/helpers/authorSerializer.js`): `serializeAuthor(doc, viewer)` returning pseudonymous profile or `{ alias, isAnonymous: true, isOP, isMine }`. Per-thread HMAC alias via `getAnonymousAlias()`. Integrated across `feedEnricher`, `commentController`, `postController`, feeds, and search.
  - [x] 1.3 Profile Leak Protection: Excluded `isAnonymous` content from `/api/users/:username/posts` for non-author viewers and sanitized saved posts.
  - [x] 1.4 Anonymous Notifications: Replaced username disclosures with generic messages ("Someone upvoted your post", "Someone commented on your post") with `actor: null`.
  - [x] 1.5 Delayed Karma Sync: Implemented `queueDelayedKarma` and `flushDelayedKarma` in `backend/services/karmaService.js` to batch and jitter anonymous post/comment karma sync, thwarting timing de-anonymization attacks.
  - [x] 1.6 Admin Accountability: AES-256-GCM encrypted author reference (`backend/utils/encryption.js`), decrypted only via `POST /api/admin/reveal-author` with mandatory reason; write audit trail to `AuditLog`.
  - [x] 1.7 Automated Leak Detection Suite: Created `backend/scripts/testAnonymityLeaks.js` asserting zero identity leaks across 18 GET endpoints, WebSocket payloads, author self-views, and admin deanonymization accountability.
- [x] **Q2.1 — Persist Batching & LastMessage Coalescing**:
  - Implemented asynchronous batch buffer (`persistBatch`, capped at 50 messages or flushed every $\le 20\text{ ms}$) using `Message.bulkWrite(ops, { ordered: false })`.
  - Handled idempotent duplicate keys (code 11000) within `bulkWrite` write errors cleanly.
  - Coalesced multiple conversation `lastMessage` updates within each flush into ONE bulk write (`Conversation.bulkWrite`), drastically cutting DB write amplification and event loop lag.
  - Guaranteed relay emit executes before any `await` or DB write; sender ack is deferred and resolved per message once batch persist succeeds.
  - Added flush on SIGTERM/SIGINT graceful shutdown.
  - Verified with `chat-bench.js` (1,000 messages): delivery p50 = 0.36 ms, p95 = 2.24 ms; persist p50 = 17.87 ms, p95 = 34.23 ms; throughput = 1,440.9 msgs/sec. All quality gates passed.
- [x] **Q2.2 — Event-Loop Health & TCP_NODELAY**:
  - Implemented `backend/utils/eventLoopMonitor.js` using `perf_hooks.monitorEventLoopDelay({ resolution: 10 })` to track p50, p95, p99, max, and mean event-loop delay.
  - Exposed live event-loop lag metrics under `eventLoop` in `GET /api/health`.
  - Audited socket paths: 0 sync fs calls, 0 heavy loops, 0 large synchronous JSON serialization on hot paths.
  - Tuned MongoDB connection pool in `backend/config/database.js` (`maxPoolSize: 50`, `minPoolSize: 10`, `serverSelectionTimeoutMS: 5000`, `socketTimeoutMS: 45000`).
  - Enabled `TCP_NODELAY` (`socket.setNoDelay(true)`) across all incoming HTTP and WebSocket transport connections, disabling Nagle's algorithm to eliminate network buffering jitter.
  - Verified throughput reached 1,652.9 msgs/sec with delivery p50 = 0.34 ms, p95 = 2.21 ms, and persist p95 = 29.71 ms.
- [x] **Q2.3 — Prebuilt Message Payload & Socket Payload Minimization**:
  - Prebuilt single lean message payload object once (`messagePayload`) and reused it directly across both the WebSocket broadcast and the batched persistence queue.
  - Dropped redundant/dead `tempId` and unneeded internal properties from WebSocket payloads, reducing payload byte size and serialization overhead.
  - Re-benchmarked with 1,000 messages: delivery p50 = 0.50 ms, p95 = 3.30 ms; persist p50 = 18.73 ms, p95 = 37.37 ms. All quality gates passed.
- [x] **Q2.4 — Reconnect Storm Protection**:
  - Configured client reconnect exponential backoff with random jitter (`randomizationFactor: 0.5`, `reconnectionDelay: 1000`, `reconnectionDelayMax: 5000`) in `SocketContext.jsx` to prevent thundering herd reconnect storms.
  - Ensured server never executes heavy DB work on connection handler: uses in-memory `userCache` for fast handshake auth.
  - Debounced presence broadcasting (`broadcastPresence`) by 200ms to coalesce burst reconnections into single updates, preventing $O(N^2)$ socket broadcast storms.
  - Verified with benchmark: delivery p50 = 0.37 ms, p95 = 2.27 ms; persist p50 = 18.01 ms, p95 = 37.47 ms. All quality gates passed.
- [x] **Q2.5 — Upgrade chat-bench.js to Strict Budget Suite**:
  - Upgraded `backend/scripts/chat-bench.js` to execute 200-msg warmup followed by 3 iterations of 1,000 messages each.
  - Added event loop monitor reset (`POST /api/health/reset-eventloop`) and live p99 event-loop lag sampling per run.
  - Calculated median of 3 runs and compared against budget:
    - `delivery p50`: **0.26 ms** (Budget: < 5.0 ms) — ✅ PASS
    - `delivery p95`: **1.00 ms** (Budget: < 15.0 ms) — ✅ PASS
    - `delivery p99`: **4.20 ms** (Budget: < 40.0 ms) — ✅ PASS
    - `delivery max`: **9.31 ms** (Budget: < 100.0 ms) — ✅ PASS
    - `persisted p95`: **27.55 ms** (Budget: < 80.0 ms) — ✅ PASS
    - `event-loop lag p99`: **18.07 ms** (Budget: < 20.0 ms) — ✅ PASS
  - Reported detailed statistics: delivery stddev = 0.78 ms, persisted stddev = 6.17 ms. Exits with code 1 upon any regression.
- [x] **Q2.6 — Chat List Stability & Keying by clientMsgId**:
  - Keyed message rows stably by `msg.clientMsgId || msg._id` in `ChatPage.jsx`, retaining that key before and after server `_id` arrives.
  - Eliminated React unmount/remount flicker on socket echo / ack.
  - Preserved optimistic array index position in `addMessageDeduped` and `handleSend` until ack, preventing reorder jumps.
  - Preserved `clientMsgId` across server background message history refreshes via `existingMap`.
  - Verified with frontend build and budget benchmark: delivery p50 = 1.40 ms, p95 = 3.69 ms, persist p95 = 26.27 ms, event loop lag p99 = 16.07 ms. All quality gates passed.
- [x] **Q2.7 — Chat Scroll Stability & Overflow Anchor**:
  - Stick to bottom only when user scroll offset is within $\le 80\text{px}$ of bottom (`handleScroll`).
  - Implemented `scrollSnapshotRef` and `useLayoutEffect` to measure and compensate `scrollHeight` delta when prepending older message pages (`handleLoadEarlier`), preserving exact viewport position without visual jumps.
  - Added CSS `overflow-anchor: auto` to `.chat-messages` and `overflow-anchor: none` to buttons/banners, with dedicated bottom `.chat-scroll-anchor`.
  - Added floating "↓ New messages" pill button when scrolled up, smoothly navigating to latest messages on click.
  - Verified with frontend build and budget benchmark: delivery p50 = 1.33 ms, p95 = 3.82 ms, persist p95 = 26.90 ms, event loop lag p99 = 15.85 ms. All quality gates passed.
- [x] **Q2.8 — Layout Shift Elimination (CLS < 0.05)**:
  - Created reusable Skeleton component suite (`frontend/src/components/Skeleton.jsx`) with `PostSkeleton`, `ConversationSkeleton`, `CommentSkeleton`, and `MessageSkeleton`.
  - Added shimmer animation `@keyframes skeletonShimmer` in `frontend/src/index.css` with dark theme palette tokens.
  - Implemented fixed dimensions, `aspect-ratio: 16/9`, `width: 100%`, and explicit placeholder container styling on media images across `PostCard.jsx` and `PostDetailPage.jsx` to eliminate layout shifts on image load.
  - Set fixed tick widths (`.msg-tick`: `display: inline-block; width: 14px; min-width: 14px; text-align: right;`) preventing horizontal text jitter during status transitions (`sending -> sent -> delivered -> read`).
  - Added reserved 20px typing slot (`.chat-typing-slot`) so typing indicator mounts and unmounts without shifting message scroll height.
  - Integrated `PostSkeleton` in `HomeFeed.jsx`, `LatestFeed.jsx`, and `PopularFeed.jsx`. Verified with build and budget benchmark suite.
- [x] **Q2.9 — Render Storm Elimination & Context Splitting**:
  - Split `SocketContext` into three dedicated, memoized React contexts (`SocketContext`, `PresenceContext`, `TypingContext`) with dedicated hooks (`useSocket`, `usePresence`, `useTyping`).
  - Isolated presence and typing state: components consuming only socket transport (e.g. `LatestFeed`) or message rows no longer re-render on presence or typing indicator updates.
  - Created `MessageRow` wrapped in `React.memo` with custom comparator, avoiding re-renders of older message bubbles when new messages arrive.
  - Isolated input state inside `<ChatInput>`: user keystrokes never trigger re-renders in the parent chat page or message list.
  - Isolated typing indicator into `<ChatTypingSlot>`: typing events only re-render the 20px slot, preserving stable message list layout.
  - Batched bursty socket messages using `requestAnimationFrame` before dispatching React state updates. Verified with frontend build and budget benchmark (delivery p50 = 0.96 ms, p95 = 2.43 ms, persist p95 = 24.03 ms, event loop lag p99 = 15.90 ms).
- [x] **Q2.10 — Feed Smoothness: Stale-While-Revalidate & Optimistic Vote/Save**:
  - Created `frontend/src/hooks/useFeedSWR.js` — an in-memory SWR cache with per-query TTL (60s). On tab return or sort/page change: stale data is displayed instantly (0ms flash), then re-fetched silently in background with `● updating...` badge.
  - Integrated `useFeedSWR` in `HomeFeed.jsx`, `LatestFeed.jsx`, and `PopularFeed.jsx`. Feed mutation (delete) is applied optimistically via `mutate()` without re-fetching.
  - Implemented optimistic voting in `PostCard.jsx`: applies delta to score immediately, corrects to server value on success, rolls back on error (with guard flag to prevent double-clicks).
  - Implemented optimistic save toggle in `PostCard.jsx` and `PostDetailPage.jsx`: flips `isSaved` instantly, rolls back on API error.
  - Implemented optimistic voting in `PostDetailPage.jsx` with identical delta-and-rollback pattern.
  - Verified: frontend build 0 errors, all 3 test suites pass.
- [x] **Q2.11 — Web-Vitals Logging (CLS, INP, LCP)**:
  - Created `frontend/src/utils/webVitals.js` with `initWebVitals()`: registers `onCLS`, `onINP`, `onLCP`, `onFCP`, `onTTFB` listeners via the `web-vitals` library (dev-only dynamic import, no-op in production).
  - Budget thresholds: CLS < 0.05, INP < 200ms, LCP < 2500ms, FCP < 1800ms, TTFB < 800ms. Logs ✅/⚠️/❌ icons to console with actual values vs budget.
  - Persists running baseline to `sessionStorage["uniconnect_web_vitals_baseline"]` across navigation for comparison.
  - Initialized in `frontend/src/main.jsx`. Production builds are unaffected (dynamic import tree-shaken by Vite).
  - Verified: frontend build 0 errors (162→165 modules, bundle size unchanged in prod).
- [x] **Q3.1 — Frontend Anonymity UI: Toggle, Alias + OP Badge, Disabled Profile Links**:
  - `CreatePost.jsx`: Added "Post anonymously" checkbox toggle with dynamic submit button text (`👻 Publish Anonymously`), passed `isAnonymous` in payload.
  - `PostCard.jsx`: Updated author header to display anonymous alias (`Anon-xxxx` / `Anonymous`), rendered `[OP]` badge (blue) and `[you]` badge (green) when viewing own post, disabled clickable profile link for anonymous posts.
  - `PostDetailPage.jsx`:
    - Updated post header with same alias, `[OP]` and `[you]` badges, and disabled profile link.
    - Updated `CommentNode`: displays alias, `[OP]` badge, `[you]` badge, disables profile link, and added "Reply anonymously" checkbox for nested replies.
    - Added "Comment anonymously" checkbox to top-level comment form with `👻 Submit Anonymously` button.
  - `commentApi.js`: Added `isAnonymous` argument to `createComment` and `replyToComment`.
  - Verified: frontend build 0 errors, all 18 anonymity leak endpoints pass with zero identity leaks.
- [x] **Q3.2 — Atomic Votes & Incremental Karma**:
  - Refactored `voteController.js` to execute lock-free, atomic `$inc` updates for `upvoteCount`, `downvoteCount`, and `score` without overwriting concurrent writes.
  - Added race condition handling for `E11000` duplicate key on `Vote` unique index `{ user: 1, targetType: 1, targetId: 1 }`.
  - Hot rank is updated atomically via `$set: { hotRank }` without touching count fields.
  - Author karma increments atomically using `$inc: { 'karma.post': change, 'karma.total': change }`. Self-votes are excluded.
  - Anonymous posts and comments use `queueDelayedKarma` + jittered periodic batch flushing to prevent timing de-anonymization attacks.
  - Created `backend/scripts/testAtomicVotes.js`: verifies 20 simultaneous concurrent upvotes, vote flips (+1 -> -1), vote undo, comment voting & karma, and anonymous delayed karma. All 5 tests pass with 100% precision.
- [x] **Q3.3 — Security Hardening (Helmet, Rate Limiting, Zod, Sanitization, Lockout, Uploads)**:
  - **Helmet**: Integrated `helmet` with `crossOriginResourcePolicy: { policy: "cross-origin" }` in `app.js` to enable secure resource sharing with media/avatars.
  - **Rate Limiting**: Built `backend/middleware/rateLimiter.js` with `generalLimiter` (300 req/15m), `authLimiter` (15 req/15m on auth routes), and `createLimiter` (40 req/15m on posts/comments).
  - **Zod Validation**: Created `backend/middleware/validate.js` and comprehensive schemas (`authValidation.js`, `postValidation.js`, `commentValidation.js`). Validates requests and returns structured 400 Bad Request with field-level errors.
  - **Markdown Sanitization**: Created `backend/utils/sanitizer.js` with `sanitize-html`. Strips `<script>`, inline event handlers (`onerror`, `onload`), and `javascript:` URIs from post titles, body, and comments while enforcing `rel="noopener noreferrer nofollow"` on links.
  - **Login Lockout**: Added `failedLoginAttempts` and `lockUntil` to `User` schema. Locks accounts for 15 minutes after 5 consecutive failed login attempts (returns 429), preventing credential brute-forcing. Resets cleanly on successful login.
  - **Image Upload Validation**: Enhanced `uploadMiddleware.js` with MIME whitelist (`image/jpeg`, `image/png`, `image/webp`, `image/gif`), extension matching, 5MB limit, and binary magic byte verification on disk (`validateUploadedImage`) that unlinks and rejects disguised scripts.
  - Created `backend/scripts/testSecurityHardening.js`: verified all 5 security pillars with 100% pass rate.
- [x] **Q4.1a — Code Style: ESLint & Prettier Configuration Across Frontend & Backend**:
  - Configured root `.prettierrc.json`, `.prettierignore`, and `.editorconfig` with consistent standards (single quotes, 2-space indentation, 100 column print width).
  - Configured backend ESLint 9 (`backend/eslint.config.js`) with `@eslint/js` for Node.js/CommonJS. Resolved missing imports (`SavedPost` in `postController.js`, `typingTimers` in `socketService.js`). Achieved 0 ESLint errors.
  - Configured frontend ESLint 9 (`frontend/eslint.config.js`) for React 18, React hooks, and Vite. Resolved missing context definitions (`useMemo`, `PresenceContext`, `TypingContext` in `SocketContext.jsx`, render-safe ref handling in `useFeedSWR.js`). Achieved 0 ESLint errors.
  - Added `lint`, `lint:fix`, and `format` npm scripts to both `frontend/package.json` and `backend/package.json`. Formatted all source files with Prettier.
- [x] **Q4.1b — Automated Test Suites with Jest**:
  - Configured backend Jest runner (`backend/jest.config.js`, `testEnvironment: 'node'`, coverage collection across controllers, middleware, services, utils).
  - Built test lifecycle environment harness (`backend/tests/setup.js`) connecting to dev MongoDB test database, tearing down safely after completion.
  - Built 4 comprehensive test suites:
    - `health.test.js`: Validates `/api/health` 200 OK, database connected, event-loop lag metrics, and Helmet security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`).
    - `auth.test.js`: Validates Zod request validation rejection, user registration, JWT access token and cookie generation on login, and 5-attempt brute-force account lockout.
    - `votes.test.js`: Validates atomic upvote, post score increment, author karma increment, vote flipping (+1 -> -1), and idempotent vote undoing.
    - `anonymity.test.js`: Validates anonymous post creation, zero-leak author suppression for third-party viewers (`author.alias` present, `username`/`email`/`_id` stripped), and OP author viewing privileges.
  - Added `test` and `test:coverage` scripts. 100% tests passing (10/10 tests across 4 suites).
- [x] **Q4.1c — CI/CD Pipeline (GitHub Actions)**:
  - Created `.github/workflows/ci.yml` with parallel `backend-checks` and `frontend-checks` jobs.
  - Configured triggers on push and pull request against `hardening` and `main`, with concurrency group auto-cancelling stale runs.
  - Backend job provisions a containerized MongoDB 6.0 service with health checks, sets up Node.js 20 with npm caching, installs dependencies (`npm ci`), runs ESLint (`npm run lint`), and executes Jest tests with coverage reporting (`npm run test:coverage`).
  - Frontend job sets up Node.js 20 with npm caching, installs dependencies (`npm ci`), runs ESLint (`npm run lint`), and compiles the production Vite bundle (`npm run build`).
- [x] **Q4.1d — Containerization: Multi-Stage Dockerfiles & Docker Compose**:
  - `backend/Dockerfile`: Multi-stage build (Node.js 20 Alpine). Compiles native C++ dependencies in builder, creates lean unprivileged `node` runner image, and configures container `HEALTHCHECK` against `http://localhost:5000/api/health`.
  - `backend/.dockerignore`: Prevents `node_modules`, secrets, tests, coverage, and git tracking from inflating the build context.
  - `frontend/Dockerfile`: Multi-stage build (Node 20 Alpine builder -> Nginx 1.27 Alpine runtime) serving optimized Vite static bundles.
  - `frontend/nginx.conf`: Production Nginx config featuring client SPA routing (`try_files $uri $uri/ /index.html;`), gzip compression, long-term static asset caching (`immutable`), and transparent reverse proxying for `/api/` and `/socket.io/` to backend.
  - `frontend/.dockerignore`: Excludes host `node_modules` and local artifacts.
  - `docker-compose.yml`: Fully orchestrated local and production environment linking `mongo:6.0` (with persistent volume and `mongosh` health check), `backend`, and `frontend` across a unified bridge network (`uniconnect-network`). Validated with `docker compose config`.
- [x] **Q4.1e — Observability: Structured Logging & Enhanced Health Check with Dependency Monitoring**:
  - `backend/utils/logger.js`: Zero-overhead structured logger supporting JSON log events in production, colorized developer console in development, and log levels (`debug`, `info`, `warn`, `error`).
  - `backend/middleware/requestId.js`: Generates / preserves UUID `req.id` and emits `X-Request-Id` header for end-to-end request tracing.
  - `backend/middleware/requestLogger.js`: Tracks high-precision duration (`process.hrtime.bigint()`) and emits structured HTTP telemetry (`requestId`, `method`, `url`, `status`, `durationMs`, `ip`, `userAgent`).
  - `backend/middleware/errorMiddleware.js`: Integrates structured logger for 500 errors with request correlation context and stack traces.
  - Enhanced `GET /api/health`: Executes live MongoDB database ping with round-trip latency measurement (`dbLatencyMs`), monitors memory footprint (`rssMB`, `heapUsedMB`, `heapPercent`), reports system process details (`nodeVersion`, `uptime`, `pid`), tracks Redis cache state, and returns HTTP 503 if primary database connection fails.
  - Test suite (`health.test.js`) updated and verified (11/11 tests passing).
- [x] **Q4.1f — Data Seeding: Idempotent Campus Communities & Rich Activity**:
  - Built robust, idempotent campus seed engine (`backend/scripts/seed.js`) with host safety check (`MONGO_URI` host verified localhost / 127.0.0.1; aborts on external hosts).
  - Supports `--fresh` / `--clean` flag for intentional dev purge, while default run operates 100% idempotently using find-or-create patterns.
  - Seeds 9 campus persona accounts with hashed credentials (`Password@123`), bio, and karma (`quietfalcon`, `quietowl`, `bytefox`, `randompixel`, `nightshift`, `voidwalker`, `campus_dean`, `prof_turing`, `sysadm`).
  - Seeds 7 core campus communities: `c/campus-life`, `c/cs-department`, `c/career-advice`, `c/courses-professors`, `c/housing-roommates`, `c/chaos`, `c/play-round`.
  - Seeds 12 campus posts across categories, including anonymous posts with encrypted author references (`encryptAuthor`), calculated hot ranks, and threaded nested comment replies.
  - Seeds direct conversations and realistic notifications. Verified with double-run idempotency check.

---

## 3. Phase 0 Audit Findings

### (a) Architecture Summary
- **Frontend Layer**:
  - React 18.3.1 SPA with Vite 6.4.3 bundler.
  - Declarative client routing via React Router DOM v6.28.2.
  - HTTP communication via Axios with token refresh interceptor handling 401s via `/api/auth/refresh-token`.
  - Real-time client via `socket.io-client` v4.8.3 with JWT auth handshake, room subscriptions (`conv_${id}`), presence changes, and typing indicators.
- **Backend Layer**:
  - Node.js with Express 5.2.1.
  - Database access via Mongoose 9.9.1 to MongoDB `uniconnect`.
  - Stateless 15-minute access token JWT + 7-day refresh token rotation stored hashed in `RefreshToken` collection, transported in HttpOnly cookie.
  - Socket.IO 4.8.3 real-time server with room scoping, presence tracking, and message broadcasting.
  - 14 Data Models: `User`, `Community`, `CommunityMember`, `Post`, `Comment`, `Vote`, `SavedPost`, `Conversation`, `Message`, `Notification`, `Report`, `Block`, `RefreshToken`, `AuditLog`.

---

### (b) Bugs, Security Holes & Anonymity Leaks Found

#### 🔴 CRITICAL ANONYMITY LEAKS (RESOLVED)
1. **`Post` Model & `enrichPosts` Identity Leak** [RESOLVED]:
   - Added `isAnonymous` and `encryptedAuthor` to `Post` schema.
   - `feedEnricher.js` now routes through `serializeAuthor`.
2. **`Comment` Model & `sanitizeComment` Identity Leak** [RESOLVED]:
   - Added `isAnonymous` and `encryptedAuthor` to `Comment` schema.
   - `commentController.sanitizeComment` routes through `serializeAuthor` with per-thread HMAC alias and `isOP` flag.
3. **Public Profile Post Leaks (`userController.getPublicPosts`)** [RESOLVED]:
   - Anonymous posts are now strictly excluded for external viewers.
4. **Notification Message Text Username Leak** [RESOLVED]:
   - Vote and comment notifications for anonymous actions use generic messages with null actor.
5. **Search Results Leak** [RESOLVED]:
   - Search results route through `enrichPosts` and `serializeAuthor`.

#### 🔴 CRITICAL RUNTIME BUGS & STABILITY
6. **Fatal Login Crash on 2nd Login (Duplicate Key Error 11000 on `token_1`)**:
   - In MongoDB, `refreshtokens` contains a legacy unique index on `token_1`.
   - The current `tokenService.js` creates refresh tokens storing `tokenHash`, leaving `token: null`.
   - When a second user or second session logs in, MongoDB rejects the duplicate `{ token: null }`, throwing an unhandled `E11000` duplicate key error, which the API returns as `409 { success: false, message: "Token already exists" }`.
7. **Missing Helmet Middleware**:
   - Helmet is installed in `package.json` (`"helmet": "^8.3.0"`), but `backend/app.js` **never imports or mounts `helmet()`**.
8. **Vite Dynamic & Static Import Collision**:
   - `frontend/src/pages/ChatPage.jsx` imports `chatApi.js` both statically and dynamically, triggering Vite build warnings.
9. **Vote Controller Race Condition**:
   - `voteController.js` performs 3 sequential operations on a vote: `findByIdAndUpdate`, another safety `findByIdAndUpdate`, then `.save()`, causing document write conflicts under concurrent requests.
10. **Lack of Rate Limiting**:
    - Sensitive authentication and posting routes have no request rate limiting.

---

### (c) N+1 Queries & Missing Database Indexes

#### Missing Indexes:
1. **`RefreshToken`**:
   - Missing index on `{ tokenHash: 1 }`. Every token refresh (`validateStoredRefreshToken`) and token revocation (`revokeRefreshToken`) performs a full collection scan.
2. **`Post`**:
   - Missing compound index `{ status: 1, hotRank: -1 }` (Hot/Popular feed).
   - Missing compound index `{ status: 1, score: -1 }` (Top feed).
   - Missing compound index `{ author: 1, createdAt: -1 }` (User profile posts list).
3. **`Comment`**:
   - Missing compound index `{ parentComment: 1, status: 1 }` (Used by `Comment.exists` on delete).
4. **`Community`**:
   - Missing compound index `{ visibility: 1, membersCount: -1 }` (Explore communities sorted by popularity).
   - Missing index on `{ creator: 1 }`.
5. **`Block`**:
   - Missing index on `{ blocked: 1 }` (Currently only `{ blocker: 1, blocked: 1 }` exists, which cannot index queries searching by `blocked`).
6. **`Message`**:
   - Missing compound index on `{ conversation: 1, isRead: 1 }`.

#### N+1 / Sub-optimal Query Patterns:
- `adminController.getStats`: Executes 11 individual count queries.
- `feedController.getHomeFeed`: Fetches full Mongoose documents for `CommunityMember` without `.lean()` or `.select('community')` before `$in` query.
- `commentController.deleteComment`: Executes sequential cascading reads and updates to parent comments and posts.

---

### (d) Chat Architecture & Latency Audit
Detailed inspection of `socketService.js`, `chatController.js`, `SocketContext.jsx`, `ChatPage.jsx`, `Message.js`, and `Conversation.js`:

1. **Step-by-step trace on `send_message` (DB calls & awaits)**:
   - Client sends `send_message` over WebSocket with `{ conversationId, content, clientMsgId, tempId, attachments }` and optional ack callback `ackCb`.
   - **Step 1 (Payload Validation)**: Validates `conversationId` and `content` (trimmed string, 1 to 2,000 characters). 0 DB calls, 0 awaits.
   - **Step 2 (Socket Rate Limiting)**: Evaluates in-memory Map `socketRateLimits` against socket ID (window: 20 msgs / 10s). 0 DB calls, 0 awaits.
   - **Step 3 (Idempotency & Deduplication)**: Checks in-memory Map `processedClientMsgs` using `clientMsgId || tempId`. If previously processed, acknowledges immediately. 0 DB calls, 0 awaits.
   - **Step 4 (Conversation Membership Check)**: Calls `getCachedConversation(conversationId)`.
     - *Hot Path*: Hits in-memory `conversationCache`. 0 DB calls, 0 awaits.
     - *Cold Path (Cache Miss)*: Executes `await Conversation.findById(conversationId).select('participants').lean()`. (1 DB read).
     - Confirms `conv.participants.includes(userId)`.
   - **Step 5 (Blocklist Verification)**: Calls `isUserBlocked(userId, peerId)`.
     - *Hot Path*: Checks in-memory `blockCache`. 0 DB calls, 0 awaits.
     - *Cold Path (Cache Miss)*: Executes `await Block.findOne({ $or: [...] }).lean()`. (1 DB read).
   - **Step 6 (RELAY FIRST — Immediate Delivery)**: Server generates `new mongoose.Types.ObjectId()`, formats payload with `status: 'sent'`, and broadcasts immediately via `io.to(conversationId).emit('new_message', payload)`. Executes `ackCb({ status: 'sent', clientMsgId, messageId })`. 0 DB calls.
   - **Step 7 (PERSIST SECOND — Asynchronous Background Write)**: Dispatches `persistMessageAsync(...)` fire-and-forget background worker:
     - `await Message.create({ _id: messageId, conversation, sender, content, clientMsgId, attachments, createdAt: msgDate })` (1 async MongoDB insert).
     - `await Conversation.findByIdAndUpdate(conversationId, { $set: { lastMessage: messageId, lastMessageAt: msgDate } })` (1 async atomic MongoDB update).
     - On error, executes exponential backoff retry queue (50ms, 150ms, 450ms) up to 3 attempts; emits `message_failed` if exhausted.

2. **Persistence vs Broadcast Order**:
   - In baseline: The message was persisted to MongoDB **BEFORE** being broadcast to the room, binding delivery latency directly to disk I/O and Mongoose serialization.
   - In optimized engine: Relay-first, persist-second. The message is broadcast to room participants and acknowledged to the sender **IMMEDIATELY**, followed by asynchronous MongoDB persistence.

3. **DB hits on the hot path**:
   - *Socket JWT Auth Handshake*: Cached via `userCache`. Cold connect: 1 DB read; repeated reconnects / fast path: **0 DB hits**.
   - *Send Message Hot Path*: Uses in-memory `conversationCache` and `blockCache`. **0 synchronous DB reads**. Only asynchronous background writes off the critical delivery path.

4. **Transport Configuration**:
   - `transports: ['websocket']` only on both server and client (skips HTTP long-polling upgrade handshake).
   - `perMessageDeflate: false` on Socket.IO server (disables zlib compression overhead for sub-millisecond small payloads).
   - Tuned `pingInterval: 25000` / `pingTimeout: 20000`.
   - `connectionStateRecovery` enabled (buffers packets and rooms across brief disconnects up to 2 minutes).

5. **Indexes on Message & Conversation**:
   - `Message`:
     - `{ conversation: 1, createdAt: -1 }` (compound index for fast cursor pagination).
     - `{ conversation: 1, isRead: 1 }` (compound index for batch read receipts query).
     - `{ clientMsgId: 1 }` (sparse index for deduplication and client lookup).
   - `Conversation`:
     - `{ participants: 1, lastMessageAt: -1 }` (compound index for recent conversation ordering).

6. **Frontend Optimistic UI, Deduplication & Reconnects**:
   - *Optimistic UI*: `ChatPage.jsx` inserts message immediately into UI state with `status: 'sending'`.
   - *Deduplication*: Generates `clientMsgId` per message; `addMessageDeduped` seamlessly reconciles pending temp messages with server socket echoes.
   - *State Progression*: Moves states `sending` (🕒) $\to$ `sent` (✓) $\to$ `delivered` (✓✓) $\to$ `read` (✓✓ cyan). Failed messages display `⚠️ Undelivered` with inline `Retry` button.
   - *Reconnects*: `SocketContext.jsx` queues messages during offline disconnects into an in-memory buffer, auto-flushing them on socket reconnect. `ChatPage.jsx` automatically re-joins active conversation rooms upon reconnection.

---

## 4. Autonomous Queue

### Q0: Backlog A Leftovers
- [x] 0.1 Unique index on Message `{sender: 1, clientMsgId: 1}` (partial filter expression: `clientMsgId: { $type: "string" }`). On duplicate-key error (code 11000), ack success (idempotent dedupe).
- [x] 0.2 TTL/LRU cap on `processedClientMsgs`, `userRateLimits`, and hot caches (max size + expiry sweep). No unbounded Maps.
- [x] 0.3 Retry the `Conversation.lastMessage` update independently of `Message.create`; log failures with conversation ID.
- [x] 0.4 If persistence finally fails after all retries, emit `message_failed` to BOTH participants so the recipient UI removes the speculative message.
- [x] 0.5 Use ONE timestamp for relay payload and DB `createdAt` so DB order always equals broadcast order.
- [x] 0.6 Document in `AGENT_PROGRESS.md` that `connectionStateRecovery` does not work with the classic Redis adapter, and that in-memory caches require pub/sub invalidation across multiple Node instances.

### Q1: Phase 2 Anonymity Engine
- [x] 1.1 Schema: Add `isAnonymous` (Boolean, default false, indexed with `{ author: 1, isAnonymous: 1 }`) to Post and Comment. Idempotent migration script verified.
- [x] 1.2 Centralized Author Serializer (`backend/helpers/authorSerializer.js`): `serializeAuthor(doc, viewer)` returning public profile or `{ alias, isAnonymous: true }`. Per-thread HMAC alias via `getAnonymousAlias()`. Server-side `isOP` flag. `isMine: true` for author only. Replace direct populates across controllers, feeds, search, notifications, votes, admin, sockets.
- [x] 1.3 Profile Leak Protection: Exclude `isAnonymous` content from `/api/users/:username/posts`, comments tab, profile counts, and other users' saved lists.
- [x] 1.4 Anonymous Notifications: Generic text ("Someone replied to your post") with no sender ID stored or transmitted.
- [x] 1.5 Delayed Karma Sync: Apply anonymous vote karma changes in batched/delayed intervals so profile karma jumps cannot be de-anonymized.
- [x] 1.6 Admin Accountability: AES-256-GCM encrypted author reference, decrypted only via `POST /api/admin/reveal-author` with mandatory reason; write audit trail to `AuditLog`.
- [x] 1.7 Automated Leak Detection Suite: `backend/scripts/testAnonymityLeaks.js` asserting zero identity leaks across all GET endpoints and sockets.

### Q2: Jitter Elimination
- [x] 2.1 Persist batching: buffer writes with `bulkWrite` every $\le 25\text{ ms}$ or 50 messages. Coalesce `lastMessage`.
- [x] 2.2 Event-loop health: `monitorEventLoopDelay`, expose p99 lag in `/api/health`, tune Mongo `maxPoolSize`, `TCP_NODELAY`.
- [x] 2.3 Prebuild message payload once; drop unneeded socket fields.
- [x] 2.4 Reconnect storms: exponential backoff with jitter (`randomizationFactor: 0.5`).
- [x] 2.5 Upgrade `chat-bench.js` to Budget format (warmup, median of 3 runs, event-loop lag).
- [x] 2.6 Chat list stability: key rows by `clientMsgId`.
- [x] 2.7 Scroll behavior: preserve scroll delta on prepending older pages, CSS `overflow-anchor`.
- [x] 2.8 Layout shift: fixed-size avatars, aspect ratios, skeletons (CLS < 0.05).
- [x] 2.9 Render storms: React.memo message rows, split SocketContext.
- [x] 2.10 Feed smoothness: stale-while-revalidate, optimistic vote/save with rollback.
- [x] 2.11 Web-vitals logging (CLS, INP, LCP).

### Q3: Frontend Anonymity & Hardening
- [x] 3.1 Frontend anonymity UI: post anonymously toggle, alias + OP badge, profile links disabled.
- [x] 3.2 Atomic votes and incremental karma.
- [x] 3.3 Security: Helmet, rate limiting, zod validation, markdown sanitization, login lockout, image upload validation.

### Q4: Engineering Base
- [x] 4.1a Code style: ESLint & Prettier configuration across frontend and backend.
- [x] 4.1b Automated test suites: Jest integration & unit test suite with coverage scripts.
- [x] 4.1c CI/CD pipeline: GitHub Actions workflow (`.github/workflows/ci.yml`) for lint, tests, and build.
- [x] 4.1d Containerization: Multi-stage Dockerfiles for backend and frontend + `docker-compose.yml`.
- [x] 4.1e Observability: Structured logging, enhanced health check (`/api/health`) with dependency monitoring.
- [x] 4.1f Data seeding: Idempotent campus communities, demo users, posts, and topics seed script.
- [ ] 4.1g API documentation: OpenAPI 3.0 specification & Swagger UI at `/api/docs`.

### Q5: High-Value Features
- [ ] 5.1 Course & professor reviews
- [ ] 5.2 Polls in posts
- [ ] 5.3 Resource library
- [ ] 5.4 Hot ranking
- [ ] 5.5 Mentions & autocomplete
- [ ] 5.6 Study groups
- [ ] 5.7 Campus events & RSVP
- [ ] 5.8 PWA & Web Push
- [ ] 5.9 Onboarding
- [ ] 5.10 Notification preferences & digest
- [ ] 5.11 Automod & moderation reports
- [ ] 5.12 Lost & Found and marketplace

### Q6: Final Polish
- [ ] 6.1 Accessibility, Lighthouse mobile $\ge 90$, theme check, final demonstration script.
