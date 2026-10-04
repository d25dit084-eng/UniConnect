# UniConnect — Comprehensive Project Brief & Technical Specification
> **Anonymous Reddit-Style Social Networking Platform Built for College Communities**

---

## 1. Executive Summary & Project Overview

**UniConnect** is a full-stack, anonymous, and pseudonymous social media platform tailored for university and college ecosystems. Drawing inspiration from platforms like Reddit, UniConnect empowers students, faculty, and campus members to converse, ask questions, share resources, review courses, and participate in candid discussions through unique pseudonymous identities (e.g., `u/campus_coder`, `c/cs-department`) rather than their legal names.

By decoupling real-world identities from campus discourse, UniConnect eliminates social friction, fear of peer judgment, and institutional retaliation, while maintaining accountability through karma reputation systems, community-level moderation, and reporting mechanisms.

### Platform Key Stats & Architecture
- **Architecture:** Client-Server Decoupled Monorepo (React SPA + Node/Express REST API + Socket.IO WebSockets)
- **Primary Database:** MongoDB with Mongoose ODM (13 collections/schemas)
- **Real-Time Engine:** Full-duplex WebSocket messaging engine
- **Authentication:** Stateless JWT access tokens (15m) + persistent refresh token rotation (7d)
- **UI Architecture:** Vanilla CSS mobile-first responsive layout (320px to 1440px+)

---

## 2. Complete Technology Stack

### Frontend Layer
| Component | Technology | Version | Purpose |
|---|---|---|---|
| **Framework** | React | `18.3.1` | Single Page Application UI engine |
| **Bundler & Tooling** | Vite | `6.4.3` | Ultra-fast ESM compilation & Hot Module Replacement |
| **Routing** | React Router DOM | `6.28.2` | Declarative client-side routing & page guards |
| **HTTP Client** | Axios | `1.7.9` | Request/response interceptors with automatic token refresh |
| **Real-Time Client** | Socket.io-client | `4.8.3` | WebSocket bidirectional connection with auto-reconnect |
| **Graphics & FX** | OGL | `1.0.11` | High-performance WebGL canvas effects |
| **Styling** | Vanilla CSS | Modern CSS | Design tokens, CSS variables, dark/light themes, zero bulky frameworks |

### Backend Layer
| Component | Technology | Version | Purpose |
|---|---|---|---|
| **Runtime** | Node.js | `>= 18.x` | JavaScript asynchronous server runtime |
| **Web Framework** | Express | `5.2.1` | REST API routing, middleware chaining, and controller handlers |
| **Real-Time Server**| Socket.IO | `4.8.3` | WebSocket events, room subscriptions, typing status, presence |
| **Database ODM** | Mongoose | `9.9.1` | Schema validation, indexing, and MongoDB queries |
| **Database** | MongoDB | `>= 6.0` | Document database for accounts, posts, messages, votes |
| **Auth & Hashing** | JSON Web Tokens & bcrypt | `9.0.3` / `6.0.0` | JWT authentication + bcrypt (12 salt rounds) |
| **File Uploads** | Multer | `2.2.0` | Multi-part form parsing & local disk storage |
| **Security & Headers** | Helmet & CORS | `8.3.0` / `2.8.6` | HTTP security headers, CORS origin whitelisting |
| **Cookie Parsing** | Cookie-Parser | `1.4.7` | HttpOnly cookie management for refresh tokens |
| **Logging** | Morgan | `1.11.0` | Structured HTTP request logs |
| **Mailer** | Nodemailer | `6.10.1` | SMTP email dispatch with dev console fallback |

---

## 3. Core Features & Functional Modules

1. **Pseudonymous Identity & User Profiles**
   - Register with username (`u/handle`) and verified college email.
   - Real names and student IDs are never exposed publicly.
   - Dynamic profile screens showing joined communities, submitted posts, comments, total karma score, and bio.
   - Privacy controls: toggle DM permissions, online presence indicator, and profile visibility.

2. **Communities (`c/community-name`)**
   - Micro-communities categorized by department, batch, interest, or club.
   - Creator ownership with moderator privileges.
   - Join/leave capabilities with real-time membership counts.
   - Community rules, descriptions, icons, and banner media.

3. **Post Creation & Rich Media**
   - Multi-format authoring: Text posts, image uploads, and external link previews.
   - **True Anonymity Toggle:** Post without displaying even your pseudonym.
   - Tri-feed categorization: **Home Feed** (joined communities), **Popular Feed** (karma-ranked), and **Latest Feed** (chronological).

4. **Nested Threaded Comments Engine**
   - Recursive unlimited-depth comment trees.
   - Contextual replying, markdown formatting, collapse/expand comment threads.
   - Upvoting and downvoting on individual comments with dynamic score recalculation.

5. **Karma & Reputation Engine**
   - Democratic upvoting (+1) and downvoting (-1) on both posts and comments.
   - Atomic compound-indexed `Vote` schemas prevent double voting.
   - Dynamic author aggregate karma calculation.

6. **Real-Time Direct Messaging (Chat)**
   - 1-on-1 private messaging powered by WebSockets.
   - Instant message delivery with database persistence.
   - Live typing indicators (`u/student is typing...`).
   - Online/offline presence detection and broadcasting.
   - Read receipts and message delivery timestamps.
   - User blocking capability to prevent harassment.

7. **In-App Notifications**
   - Notification badges for post upvotes, comment replies, mentions, and community alerts.
   - Read / unread status and instant click-through routing to target discussions.

8. **Bookmarks & Saved Posts**
   - Private personal collection of bookmarked posts.

9. **Moderation & Admin Suite**
   - Community-level moderation panel for community creators and mods.
   - Global platform admin dashboard (`/admin`) for site-wide governance.
   - Content flagging and reporting with predefined violation reasons.
   - Content removal, temporary muting, and account ban actions.

10. **Global Search**
    - Unified search bar with real-time querying across posts, communities, and pseudonymous usernames.

---

## 4. Database Schema Architecture

The MongoDB database contains **13 specialized collections**:

- `User`: Username, email, passwordHash, avatar, bio, karma, role (`user`/`admin`), isBanned, privacy settings.
- `Community`: Name, slug, description, rules, icon, banner, privacy (`public`/`restricted`/`private`), creator ref, member counts.
- `CommunityMember`: Composite tracking of users in communities with roles (`member`, `moderator`, `admin`).
- `Post`: Title, content, type (`text`/`image`/`link`), mediaUrl, linkUrl, community ref, author ref, isAnonymous, score, upvotes, downvotes, commentCount.
- `Comment`: Post ref, parentComment ref (recursive nesting), author ref, isAnonymous, content, score.
- `Vote`: User ref, targetType (`Post`/`Comment`), targetId, value (`1`/`-1`) with unique compound index.
- `SavedPost`: User ref, post ref, saved timestamp.
- `Conversation`: Direct messaging conversation between participant user refs, last message reference.
- `Message`: Conversation ref, sender ref, text, mediaUrl, readBy array.
- `Notification`: Recipient ref, sender ref, type, targetType, targetId, isRead.
- `Report`: Reporter ref, targetType, targetId, reason, details, status (`pending`/`reviewed`/`dismissed`).
- `Block`: Blocker ref, blockedUser ref (prevents DMs).
- `RefreshToken`: Cryptographic refresh tokens with automatic MongoDB TTL expiration.

---

## 5. API Endpoints Table

| Category | Method | Path | Description |
|---|---|---|---|
| **Auth** | `POST` | `/api/auth/register` | Register new user |
| **Auth** | `POST` | `/api/auth/login` | Login & receive tokens |
| **Auth** | `POST` | `/api/auth/logout` | Revoke session & clear cookies |
| **Auth** | `POST` | `/api/auth/refresh` | Issue fresh access token |
| **Auth** | `POST` | `/api/auth/forgot-password` | Request password reset token |
| **Auth** | `POST` | `/api/auth/reset-password/:token`| Complete password reset |
| **Auth** | `GET` | `/api/auth/me` | Fetch authenticated session |
| **Feed** | `GET` | `/api/feed/home` | Personalized home feed |
| **Feed** | `GET` | `/api/feed/popular` | Global popular feed |
| **Feed** | `GET` | `/api/feed/latest` | Chronological latest feed |
| **Posts** | `GET` | `/api/posts` | Paginated post listing |
| **Posts** | `POST` | `/api/posts` | Create new post |
| **Posts** | `GET` | `/api/posts/:id` | Post detail + metadata |
| **Posts** | `POST` | `/api/posts/:id/vote` | Cast or clear post vote |
| **Posts** | `POST` | `/api/posts/:id/save` | Bookmark / unbookmark post |
| **Comments**| `GET` | `/api/comments/post/:postId` | Nested comment tree |
| **Comments**| `POST` | `/api/comments/post/:postId` | Submit top-level or reply comment |
| **Communities**| `GET` | `/api/communities` | List all communities |
| **Communities**| `POST` | `/api/communities` | Create community |
| **Communities**| `POST` | `/api/communities/:slug/join` | Join community |
| **Chat** | `GET` | `/api/chat/conversations` | User conversation list |
| **Chat** | `GET` | `/api/chat/conversations/:id/messages` | Message history |
| **Notifications**| `GET` | `/api/notifications` | Fetch notifications |
| **Search** | `GET` | `/api/search?q=:term` | Multi-entity full-text search |
| **Users** | `GET` | `/api/users/:username` | Pseudonymous profile & karma |
| **Admin** | `GET` | `/api/admin/reports` | Platform moderation queue |

---

## 6. Real-Time WebSocket Events (Socket.IO)

| Event Name | Direction | Payload & Action |
|---|---|---|
| `connection` | Client -> Server | Handshake with `{ auth: { token } }`, registers socket & binds to user room |
| `join_conversation` | Client -> Server | Joins private conversation channel `conv_${id}` |
| `send_message` | Client -> Server | Persists message to DB, broadcasts to conversation room |
| `new_message` | Server -> Client | Real-time message push delivered to conversation participants |
| `typing_start` | Client -> Server | Broadcasts typing indicator to active conversation members |
| `typing_stop` | Client -> Server | Clears typing indicator |
| `message_read` | Client -> Server | Marks message as read and informs sender |
| `presence_change` | Server -> Client | Broadcasts updated online/offline user status |

---

## 7. Setup & Running Instructions

### Prerequisites
- Node.js ≥ 18.x
- MongoDB running locally on port 27017 (or MongoDB Atlas)

### Starting Services
```bash
# Terminal 1 — Backend
cd backend
npm run dev
# Server ready on: http://localhost:5000 (Health: http://localhost:5000/api/health)

# Terminal 2 — Frontend
cd frontend
npm run dev
# Frontend ready on: http://localhost:5173
```
