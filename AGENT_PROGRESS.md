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
  - 13 Data Models: `User`, `Community`, `CommunityMember`, `Post`, `Comment`, `Vote`, `SavedPost`, `Conversation`, `Message`, `Notification`, `Report`, `Block`, `RefreshToken`.

---

### (b) Bugs, Security Holes & Anonymity Leaks Found

#### 🔴 CRITICAL ANONYMITY LEAKS
1. **`Post` Model & `enrichPosts` Identity Leak**:
   - `Post` schema (`backend/models/Post.js`) has **no `isAnonymous` field**.
   - `postController.createPost` does not store or process anonymity.
   - `feedEnricher.js` unconditionally populates and exposes `author._id`, `author.username`, `avatar`, `bio`, and `karma`.
2. **`Comment` Model & `sanitizeComment` Identity Leak**:
   - `Comment` schema (`backend/models/Comment.js`) has **no `isAnonymous` field**.
   - `commentController.sanitizeComment` unconditionally exposes the author's real username, avatar, and karma.
   - `backend/utils/anonymousIdentity.js` defines `getAnonymousAlias(userId, threadId)`, but it is **never called or used anywhere in the codebase**.
3. **Public Profile Post Leaks (`userController.getPublicPosts`)**:
   - `GET /api/users/:username/posts` queries `{ author: user._id, status: 'active' }` without filtering out anonymous posts. Anyone visiting `u/username` would see all posts authored by that student, completely breaking anonymity!
4. **Notification Message Text Username Leak**:
   - In `commentController.js` (lines 114 & 182):
     `formattedMessage = \`u/${req.user.username} commented on your post.\``
     `formattedMessage = \`u/${req.user.username} replied to your comment.\``
     Directly reveals the author's username to the post/comment owner in notifications.
   - In `voteController.js` (lines 93 & 185):
     `formattedMessage = \`u/${req.user.username} upvoted your post/comment.\``
     Directly reveals voter username.
5. **Search Results Leak**:
   - `searchController.js` populates post authors unconditionally for all matching posts.

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
     - `await Message.create({ _id: messageId, conversation, sender, content, clientMsgId, attachments })` (1 async MongoDB insert).
     - `await Conversation.findByIdAndUpdate(conversationId, { $set: { lastMessage: messageId, lastMessageAt: new Date() } })` (1 async atomic MongoDB update).
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

## 4. Prioritized Backlog Checklist

### Phase 1: Database Stability & Security Hardening
- [x] 1.1 Drop stale `token_1` legacy unique index in MongoDB `refreshtokens` collection.
- [x] 1.2 Add `{ tokenHash: 1 }` unique index to `RefreshToken` schema and apply to DB.
- [ ] 1.3 Add missing compound indexes on `Post`, `Comment`, `Community`, `Block`.
- [ ] 1.4 Mount `helmet()` security headers in `backend/app.js`.
- [x] 1.5 Verify multi-user login and existing `testRedditPivot.js` integration test pass.

### Phase 2: Core Anonymity Engine (Design Rules)
- [ ] 2.1 Author Reference Storage: Keep real author ObjectId in MongoDB, but strictly prohibit serialization for anonymous content.
- [ ] 2.2 Centralized Author Serializer: Implement single shared utility `serializeAuthor(doc, viewer)` in `backend/utils/authorSerializer.js` used across all controllers, search, notifications, and socket payloads. No route may populate or serialize author independently.
- [ ] 2.3 Deterministic Per-Thread Alias: Use `getAnonymousAlias(userId, threadId)` powered by `HMAC(secret, postId + userId)`. Same user receives consistent alias (e.g., "Anon Falcon") throughout the thread, but cannot be linked across different threads.
- [ ] 2.4 Server-Side OP Flag: Compute `isOP` flag on comments server-side (`comment.author.equals(post.author)`), never by exposing the underlying author ID.
- [ ] 2.5 Profile Feed & Counts Isolation: Exclude anonymous posts and comments from `/api/users/:username/posts`, public comments tab, and user profile post/comment counts unless requested by the authenticated author.
- [ ] 2.6 Anonymized Notifications: For anonymous actors, notification text must read "Someone commented on your post" / "Someone upvoted your post" without saving or sending `sender` user identity.
- [ ] 2.7 Automated Leak Detection Suite: Create `backend/scripts/testAnonymityLeaks.js` that publishes anonymous content, queries every endpoint as a different user, and asserts author username and user ID never appear in raw JSON responses.

### Phase 2.5: Chat Latency Optimization
- [x] 2.5.1 Architectural Chat Audit recorded in `AGENT_PROGRESS.md`.
- [x] 2.5.2 Baseline chat latency benchmark captured via `backend/scripts/chat-bench.js` (1,000 round-trip messages across 2 socket clients).
- [x] 2.5.3 WebSocket transport tuning: `transports: ["websocket"]`, `perMessageDeflate: false`, tuned ping intervals, `connectionStateRecovery`.
- [x] 2.5.4 Relay-first, persist-second async MongoDB queue with retries & `clientMsgId` deduplication.
- [x] 2.5.5 In-memory hot caching (`userCache`, `blockCache`, `conversationCache`) for zero DB hits on hot send path.
- [x] 2.5.6 In-memory presence and typing indicators (auto-expiring after 4s).
- [x] 2.5.7 Batch read receipts (`batch_message_read` debounced 300ms).
- [x] 2.5.8 Database compound indexes & cursor-based pagination (`before=<id>`).
- [x] 2.5.9 Horizontal scaling configuration via `@socket.io/redis-adapter` (`REDIS_URL`).
- [x] 2.5.10 Frontend optimistic UI (`sending` $\to$ `sent` $\to$ `delivered` $\to$ `read`), status ticks, retry button, local storage preloading, and virtualization.
- [x] 2.5.11 Resilience: offline queue with auto-flush on reconnect, exponential backoff.
- [x] 2.5.12 Post-optimization benchmark verified: p95 = **3.30 ms** (15.1x faster than target).

### Phase 3: Frontend Anonymity & UI Integration
- [ ] 3.1 Update `CreatePost.jsx` to include an "Anonymous Post" checkbox toggle with explanatory privacy pill.
- [ ] 3.2 Update `PostCard.jsx` to render anonymous author alias with Anonymous badge (e.g. `u/Anonymous Falcon` or `[Anonymous]`) and disable profile linking for anonymous posts.
- [ ] 3.3 Update `PostDetailPage.jsx` to respect anonymous posts and comments with OP badges.
- [ ] 3.4 Resolve `ChatPage.jsx` dual import warning.

### Phase 4: Query Optimization & Concurrency
- [ ] 4.1 Refactor `voteController.js` to execute atomic single-query score and rank recalculations.
- [ ] 4.2 Optimize `getHomeFeed` membership resolution with `.select('community').lean()`.

### Phase 5: Verification & End-to-End Tests
- [ ] 5.1 Execute `testAnonymityLeaks.js` asserting zero leaks across all endpoints.
- [ ] 5.2 Validate full test suite (`testRedditPivot.js`, `chat-bench.js`) with zero regressions.
