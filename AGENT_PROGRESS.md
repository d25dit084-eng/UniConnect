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
- [ ] 2.1 Persist batching: buffer writes with `bulkWrite` every $\le 25\text{ ms}$ or 50 messages. Coalesce `lastMessage`.
- [ ] 2.2 Event-loop health: `monitorEventLoopDelay`, expose p99 lag in `/api/health`, tune Mongo `maxPoolSize`, `TCP_NODELAY`.
- [ ] 2.3 Prebuild message payload once; drop unneeded socket fields.
- [ ] 2.4 Reconnect storms: exponential backoff with jitter (`randomizationFactor: 0.5`).
- [ ] 2.5 Upgrade `chat-bench.js` to Budget format (warmup, median of 3 runs, event-loop lag).
- [ ] 2.6 Chat list stability: key rows by `clientMsgId`.
- [ ] 2.7 Scroll behavior: preserve scroll delta on prepending older pages, CSS `overflow-anchor`.
- [ ] 2.8 Layout shift: fixed-size avatars, aspect ratios, skeletons (CLS < 0.05).
- [ ] 2.9 Render storms: React.memo message rows, split SocketContext.
- [ ] 2.10 Feed smoothness: stale-while-revalidate, optimistic vote/save with rollback.
- [ ] 2.11 Web-vitals logging (CLS, INP, LCP).

### Q3: Frontend Anonymity & Hardening
- [ ] 3.1 Frontend anonymity UI: post anonymously toggle, alias + OP badge, profile links disabled.
- [ ] 3.2 Atomic votes and incremental karma.
- [ ] 3.3 Security: Helmet, rate limiting, zod validation, markdown sanitization, login lockout, image upload validation.

### Q4: Engineering Base
- [ ] 4.1 ESLint + Prettier, Jest tests, GitHub Actions CI, Dockerfile + docker-compose, structured logging, health checks, seed script, OpenAPI docs.

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
