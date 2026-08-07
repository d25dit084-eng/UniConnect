# UniConnect API Specifications

All authenticated requests require `Authorization: Bearer <accessToken>`.  
All responses follow the JSON format: `{ "success": boolean, "message": string, "data": object | array }`.

---

## 1. Authentication (`/api/auth`)

- **`POST /register`**
  - **Payload:** `{ "username": "quietfalcon", "email": "student@college.edu", "password": "Password@123" }`
  - **Response:** Safe user representation. Requires email verification to active fully.
- **`POST /login`**
  - **Payload:** `{ "email": "student@college.edu", "password": "Password@123" }`
  - **Response:** `{ "accessToken": "...", "user": { ...safe public profile... } }`. Refresh token is set in an HttpOnly cookie.
- **`POST /logout`**
  - Revokes current refresh token session and clears cookies.
- **`POST /refresh-token`**
  - Rotates JWT token using the stored HTTP refresh cookie.
- **`POST /forgot-password`**
  - Sends a secure password reset link to the email.
- **`POST /reset-password/:token`**
  - **Payload:** `{ "password": "NewPassword@123" }`

---

## 2. User Profiles & Relationships (`/api/users`)

- **`GET /profile`** or **`GET /me`** [Auth]
  - Returns private account details (email, privacy configurations, interests, karma).
- **`PUT /profile`** [Auth]
  - **Payload:** Optional parameters `{ bio, avatar, allowDirectMessages, showOnlineStatus, profileVisibility, interests }`
- **`POST /verify`** [Auth]
  - Sends verification link.
- **`POST /verify/confirm`** [Auth]
  - **Payload:** `{ "token": "..." }`
- **`POST /profile/image`** [Auth]
  - Uploads user avatar (multipart upload).
- **`GET /blocked`** [Auth]
  - Returns array of users blocked by req.user.
- **`POST /:username/block`** [Auth]
  - Block target user. Blocked users cannot send direct messages.
- **`DELETE /:username/block`** [Auth]
  - Unblock target user.
- **`GET /:username`** [Optional Auth]
  - Returns public pseudonymous profile (exposes only username formatted as `u/username`, avatar, bio, karma, createdAt).
- **`GET /:username/posts`** [Optional Auth]
  - Returns active posts authored by this user, paginated.

---

## 3. Communities (`/api/communities`)

- **`POST /`** [Auth]
  - **Payload:** `{ "name": "webdev", "displayName": "Web Development", "description": "HTML, JS, and backend talk." }`
  - Creator becomes owner, moderator, and the first joined member.
- **`GET /`** [Optional Auth]
  - List public communities. Supports query `?q=` and `?sort=members|posts|newest`.
- **`GET /joined`** [Auth]
  - List communities req.user has joined.
- **`GET /:slug`** [Optional Auth]
  - Fetch community metadata. Returns `isJoined` and user's community `memberRole`.
- **`PUT /:id`** [Auth]
  - **Payload:** `{ displayName, description, icon, banner, rules, visibility }`
  - Restricted to creator or moderators.
- **`DELETE /:id`** [Auth]
  - Restricted to creator. Cascade deletes posts.
- **`POST /:id/join`** [Auth]
  - Join the community. Increments `membersCount`.
- **`DELETE /:id/leave`** [Auth]
  - Leave the community. Owner cannot leave without transferring ownership or deleting.
- **`GET /:slug/posts`** [Optional Auth]
  - Fetch community posts. Supports `?sort=hot|new|top|controversial` & pagination.
- **`GET /:slug/members`** [Optional Auth]
  - Returns paginated community member list.

---

## 4. Discussion Posts (`/api/posts`)

- **`POST /`** [Auth]
  - **Payload:** `{ "communityId": "...", "type": "text"|"image"|"link", "title": "...", "content": "...", "url": "...", "media": [...] }`
  - Validates type-specific requirements. Authors automatically upvote on creation.
- **`GET /search`** [Optional Auth]
  - Keyword search on active posts. Supports `?q=` and `?sort=hot|new|top`.
- **`GET /:id`** [Optional Auth]
  - Get post details and increment viewCount. Returns contextual `voteStatus` (1/0/-1) and `savedByMe` flag.
- **`PUT /:id`** [Auth]
  - Edit post title, content, media, or URL. Restricted to the author.
- **`DELETE /:id`** [Auth]
  - Deletes post. Restricted to author or platform admins.

---

## 5. Threaded Comments (`/api/comments`)

- **`POST /`** [Auth]
  - **Payload:** `{ "postId": "...", "content": "..." }`
  - Top-level comment. Author automatically upvotes it.
- **`GET /post/:postId`** [Optional Auth]
  - Fetch full discussion comment tree, structured in-memory.
- **`POST /:id/reply`** [Auth]
  - **Payload:** `{ "content": "..." }`
  - Reply to a comment. Depth is checked and limited to a max of 8 levels.
- **`PUT /:id`** [Auth]
  - Update comment content. Restricted to the author.
- **`DELETE /:id`** [Auth]
  - Deletes comment. If replies exist, performs soft-delete (`content` set to `[Comment deleted]`).

---

## 6. Upvoting & Downvoting (`/api/votes`)

- **`POST /votes/posts/:postId`** [Auth]
  - **Payload:** `{ "value": 1 | -1 }`
  - Upvote (+1) or downvote (-1). Toggles or switches existing vote direction. Recalculates post `hotRank` and updates author post karma.
- **`POST /votes/comments/:commentId`** [Auth]
  - **Payload:** `{ "value": 1 | -1 }`
  - Upvote (+1) or downvote (-1) on comment. Updates author comment karma.

---

## 7. Saved Posts (`/api/saved`)

- **`POST /:postId`** [Auth]
  - Save post to personal bookmarks.
- **`DELETE /:postId`** [Auth]
  - Remove post from bookmarks.
- **`GET /`** [Auth]
  - Returns paginated list of private saved posts, populated with user context.

---

## 8. Feeds (`/api/feed`)

- **`GET /home`** [Optional Auth]
  - Aggregates posts from communities the user joined. Falls back to popular feed for guests or new accounts with no joined communities. Supports `?sort=hot|new|top`.
- **`GET /latest`** [Optional Auth]
  - Returns newest active posts across all public communities, sorted by date descending.
- **`GET /popular`** [Optional Auth]
  - Returns posts sorted by Hot Rank descending.

---

## 9. Direct Message Chat (`/api/chat`)

- **`POST /conversations`** [Auth]
  - **Payload:** `{ "recipientUsername": "quietfalcon" }`
  - Create or fetch conversation room with another user. Checks blocking/privacy configurations.
- **`GET /conversations`** [Auth]
  - Returns conversation rooms list with the last active message details.
- **`GET /conversations/:id/messages`** [Auth]
  - Paginated list of messages in a conversation. Prevents IDOR access.
- **`POST /conversations/:id/messages`** [Auth]
  - **Payload:** `{ "content": "...", "attachments": [...] }`
  - Sends a message via HTTP, triggering a socket push.
- **`PATCH /messages/:id/read`** [Auth]
  - Marks message as read.
- **`DELETE /messages/:id`** [Auth]
  - Delete message. Restricted to the message sender.

---

## 10. Reports (`/api/reports`)

- **`POST /`** [Auth]
  - **Payload:** `{ "targetType": "post"|"comment"|"community"|"user"|"message", "targetId": "...", "reason": "spam"|..., "description": "..." }`
  - Reports content. Links to community automatically for moderator convenience.

---

## 11. Platform Admin (`/api/admin`)

All routes require JWT authentication + user role `admin`.
- **`GET /stats`**
  - Platform statistics (total users, posts, comments, votes, reports, etc.).
- **`GET /users`**
  - List all users with filter `verified` and `role`.
- **`GET /reports`**
  - Filterable list of all submitted reports.
- **`PATCH /reports/:id`**
  - **Payload:** `{ "status": "reviewed"|"dismissed"|"actioned", "moderationNote": "..." }`
- **`PATCH /posts/:id/moderate`**
  - **Payload:** `{ "status": "active"|"hidden"|"removed" }`
- **`PATCH /comments/:id/moderate`**
  - **Payload:** `{ "status": "active"|"hidden"|"removed" }`
