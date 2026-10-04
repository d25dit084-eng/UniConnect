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

## 4. Prioritized Backlog Checklist

### Phase 1: Database Stability & Security Hardening
- [ ] 1.1 Drop stale `token_1` legacy unique index in MongoDB `refreshtokens` collection.
- [ ] 1.2 Add `{ tokenHash: 1 }` unique index to `RefreshToken` schema and apply to DB.
- [ ] 1.3 Add missing compound indexes on `Post`, `Comment`, `Community`, `Block`, `Message`.
- [ ] 1.4 Mount `helmet()` security headers in `backend/app.js`.
- [ ] 1.5 Verify multi-user login and existing `testRedditPivot.js` integration test pass.

### Phase 2: Core Anonymity Engine
- [ ] 2.1 Add `isAnonymous: { type: Boolean, default: false }` to `Post` schema with default migrations.
- [ ] 2.2 Add `isAnonymous: { type: Boolean, default: false }` to `Comment` schema with default migrations.
- [ ] 2.3 Implement anonymization sanitization utility integrating `getAnonymousAlias(userId, threadId)`.
- [ ] 2.4 Update `feedEnricher.js`: When `post.isAnonymous === true`, strip author `_id`, `username`, `avatar`, `bio`, and `karma` for all non-admin users, replacing with deterministic thread alias and `isAnonymous: true`. Allow `isOwner` flag for post author without revealing identity to others.
- [ ] 2.5 Update `commentController.js`: When `comment.isAnonymous === true`, sanitize to thread alias.
- [ ] 2.6 Update `userController.getPublicPosts`: Exclude anonymous posts (`isAnonymous: false`) unless requested by the post author themselves with private session.
- [ ] 2.7 Update `searchController.js`: Anonymize search results for anonymous posts.
- [ ] 2.8 Update `notificationController` / `notificationService`: Ensure notifications for anonymous posts/comments and votes never expose the actor's real username.

### Phase 3: Frontend Anonymity & UI Integration
- [ ] 3.1 Update `CreatePost.jsx` to include an "Anonymous Post" checkbox toggle with explanatory privacy pill.
- [ ] 3.2 Update `PostCard.jsx` to render anonymous author alias with Anonymous badge (e.g. `u/Anonymous Falcon` or `[Anonymous]`) and disable profile linking for anonymous posts.
- [ ] 3.3 Update `PostDetailPage.jsx` to respect anonymous posts and comments.
- [ ] 3.4 Resolve `ChatPage.jsx` dual import warning.

### Phase 4: Query Optimization & Concurrency
- [ ] 4.1 Refactor `voteController.js` to execute atomic single-query score and rank recalculations.
- [ ] 4.2 Optimize `getHomeFeed` membership resolution with `.select('community').lean()`.

### Phase 5: Verification & End-to-End Tests
- [ ] 5.1 Create new test suite asserting that author identity is NEVER returned in API responses for anonymous posts/comments across feed, single post, comments, search, and user profile endpoints.
- [ ] 5.2 Validate with automated test run and verify no regression on any existing feature.
