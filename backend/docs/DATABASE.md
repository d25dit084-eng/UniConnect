# UniConnect Database Documentation

## Collection Schema & Indexes

UniConnect is backed by a MongoDB database using Mongoose schemas. Below is the list of collections, fields, and index definitions.

---

### 1. users
Stores account credentials and privacy settings.
- **Fields:**
  - `username`: String (required, unique, regex validated)
  - `email`: String (required, unique, lowercase, trim)
  - `password`: String (required, select: false)
  - `avatar`: String (default: null)
  - `profileImage`: String (alias fallback, default: null)
  - `bio`: String (maxlength 500)
  - `karma`: Object: `{ post: Number, comment: Number, total: Number }`
  - `verified`: Boolean (default: false)
  - `verificationToken`: String (select: false)
  - `verificationTokenExpires`: Date (select: false)
  - `role`: String (enum: `student`, `admin`, default: `student`)
  - `allowDirectMessages`: Boolean (default: true)
  - `showOnlineStatus`: Boolean (default: true)
  - `profileVisibility`: Boolean (default: true)
  - `interests`: Array of strings
  - `resetPasswordToken`: String (select: false)
  - `resetPasswordExpires`: Date (select: false)
- **Indexes:**
  - `username` (unique)
  - `email` (unique)

---

### 2. refreshtokens
Manages active JWT refresh sessions.
- **Fields:**
  - `user`: ObjectId (ref `User`, required)
  - `tokenHash`: String (SHA-256 hash, unique, required)
  - `expiresAt`: Date (TTL index, required)
  - `userAgent`: String
  - `ipAddress`: String
  - `isRevoked`: Boolean (default: false)

---

### 3. communities
Represents a sub-discussion space (e.g. `c/programming`).
- **Fields:**
  - `name`: String (required, unique, letters/numbers/underscores only)
  - `slug`: String (required, unique, lowercase)
  - `displayName`: String (required)
  - `description`: String (required, maxlength 500)
  - `icon`: String
  - `banner`: String
  - `creator`: ObjectId (ref `User`, required)
  - `membersCount`: Number (default: 1)
  - `postsCount`: Number (default: 0)
  - `visibility`: String (enum: `public`, `restricted`, `private`, default: `public`)
  - `rules`: Array of `{ title: String, description: String }`
  - `moderators`: Array of ObjectIds (ref `User`)
- **Indexes:**
  - `slug` (unique)
  - `visibility`

---

### 4. communitymembers
Tracks user memberships in community spaces.
- **Fields:**
  - `community`: ObjectId (ref `Community`, required)
  - `user`: ObjectId (ref `User`, required)
  - `role`: String (enum: `member`, `moderator`, `owner`, default: `member`)
  - `joinedAt`: Date (default: Date.now)
- **Indexes:**
  - `community` + `user` (unique compound index)
  - `user`

---

### 5. posts
Represents discussion threads.
- **Fields:**
  - `author`: ObjectId (ref `User`, required)
  - `community`: ObjectId (ref `Community`, required)
  - `type`: String (enum: `text`, `image`, `link`, default: `text`)
  - `title`: String (required, minlength 5, maxlength 200)
  - `content`: String (maxlength 5000)
  - `url`: String (for link posts)
  - `media`: Array of strings (for image posts)
  - `upvoteCount`: Number (default: 1)
  - `downvoteCount`: Number (default: 0)
  - `score`: Number (default: 1)
  - `hotRank`: Number (default: 0)
  - `commentCount`: Number (default: 0)
  - `viewCount`: Number (default: 0)
  - `saveCount`: Number (default: 0)
  - `status`: String (enum: `active`, `hidden`, `removed`, default: `active`)
  - `edited`: Boolean (default: false)
- **Indexes:**
  - `title` + `content` (text search index)
  - `author`
  - `community` + `createdAt`
  - `status` + `createdAt`
  - `hotRank` (descending, for popular sorting)

---

### 6. comments
Threaded discussion replies (supports nesting up to 8 levels).
- **Fields:**
  - `post`: ObjectId (ref `Post`, required)
  - `author`: ObjectId (ref `User`, required)
  - `parentComment`: ObjectId (ref `Comment`, default: null)
  - `depth`: Number (default: 0, max: 8)
  - `content`: String (required, maxlength 2000)
  - `upvoteCount`: Number (default: 1)
  - `downvoteCount`: Number (default: 0)
  - `score`: Number (default: 1)
  - `replyCount`: Number (default: 0)
  - `status`: String (enum: `active`, `hidden`, `removed`, default: `active`)
  - `isDeleted`: Boolean (soft delete flag, default: false)
- **Indexes:**
  - `post` + `parentComment` + `createdAt`
  - `author`
  - `parentComment`

---

### 7. votes
Upvotes (+1) and downvotes (-1) for posts and comments.
- **Fields:**
  - `user`: ObjectId (ref `User`, required)
  - `targetType`: String (enum: `post`, `comment`, required)
  - `targetId`: ObjectId (required, refPath: `targetType`)
  - `value`: Number (enum: `1`, `-1`, required)
- **Indexes:**
  - `user` + `targetType` + `targetId` (unique compound index)
  - `targetType` + `targetId`

---

### 8. savedposts
Private list of posts bookmarked by a user.
- **Fields:**
  - `user`: ObjectId (ref `User`, required)
  - `post`: ObjectId (ref `Post`, required)
- **Indexes:**
  - `user` + `post` (unique compound index)
  - `user` + `createdAt`

---

### 9. notifications
Action updates sent to content owners.
- **Fields:**
  - `recipient`: ObjectId (ref `User`, required)
  - `actor`: ObjectId (ref `User`, default: null) // Stored internally, hidden from responses
  - `type`: String (enum: post_vote, comment_vote, comment_reply, post_comment, community_invite, moderator_action, chat_message, system)
  - `post`: ObjectId (ref `Post`)
  - `comment`: ObjectId (ref `Comment`)
  - `community`: ObjectId (ref `Community`)
  - `message`: String (required)
  - `isRead`: Boolean (default: false)
- **Indexes:**
  - `recipient` + `isRead` + `createdAt` (for fetching unread list)
  - `recipient` + `createdAt`

---

### 10. conversations
Tracks direct messaging rooms between users.
- **Fields:**
  - `participants`: Array of ObjectIds (ref `User`, exactly 2 for DMs)
  - `lastMessage`: ObjectId (ref `Message`, default: null)
  - `lastMessageAt`: Date (default: Date.now)
- **Indexes:**
  - `participants` + `lastMessageAt`

---

### 11. messages
Private messages within a conversation.
- **Fields:**
  - `conversation`: ObjectId (ref `Conversation`, required)
  - `sender`: ObjectId (ref `User`, required)
  - `content`: String (required, maxlength 1000)
  - `attachments`: Array of strings
  - `isRead`: Boolean (default: false)
- **Indexes:**
  - `conversation` + `createdAt`

---

### 12. reports
Flagged posts, comments, messages, communities, or users.
- **Fields:**
  - `reporter`: ObjectId (ref `User`, required)
  - `targetType`: String (enum: `post`, `comment`, `community`, `user`, `message`, required)
  - `targetId`: ObjectId (required)
  - `community`: ObjectId (ref `Community`)
  - `reason`: String (enum: spam, harassment, hate, misinformation, inappropriate, privacy, other, required)
  - `description`: String (maxlength 1000)
  - `status`: String (enum: pending, reviewed, dismissed, actioned, default: `pending`)
  - `reviewedBy`: ObjectId (ref `User`)
  - `reviewedAt`: Date
  - `moderationNote`: String (maxlength 500)
- **Indexes:**
  - `status` + `createdAt`
  - `targetType` + `targetId`
  - `reporter` + `targetType` + `targetId`
  - `community`

---

### 13. blocks
User-to-user blocks preventing private messages.
- **Fields:**
  - `blocker`: ObjectId (ref `User`, required)
  - `blocked`: ObjectId (ref `User`, required)
- **Indexes:**
  - `blocker` + `blocked` (unique compound index)
  - `blocker`
