# UniConnect

> Anonymous Reddit-style social networking platform built for college communities.

UniConnect lets users interact through private pseudonymous identities (`u/username`) rather than their real-world names. Think Reddit, but designed from the ground up for anonymous campus conversation.

---

## Features

- **Anonymous / Pseudonymous Identity** — Users register with a chosen username; real names are never displayed
- **Authentication** — Secure JWT-based login, registration, refresh tokens, forgot/reset password via email
- **Communities** — Create, join, and leave communities (`c/community-name`); community moderation tools
- **Posts** — Text, link, and image posts; anonymous and attributed authorship
- **Comments & Nested Replies** — Threaded comment system with unlimited nesting depth
- **Voting** — Upvote/downvote on posts and comments; karma tracking
- **Save / Unsave** — Bookmark posts for later
- **Search** — Full-text search across posts, communities, and users
- **Real-Time Chat** — WebSocket-powered direct messaging with typing indicators, online presence, and read receipts
- **Notifications** — In-app notifications for replies, mentions, and community events
- **Community Feed** — Home feed, Popular feed, Latest feed
- **User Profiles** — Public pseudonymous profiles with post history and karma
- **Settings** — Bio, avatar upload, privacy controls (DMs, online status, profile visibility)
- **Moderation / Reporting** — Community-level moderation panel; platform-level admin dashboard
- **Blocking** — Block users from sending you direct messages

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 (Vite), React Router v6 |
| **Styling** | Vanilla CSS (responsive, mobile-first) |
| **Backend** | Node.js, Express 5 |
| **Database** | MongoDB, Mongoose |
| **Real-Time** | Socket.IO v4 (WebSockets) |
| **Authentication** | JWT (access + refresh tokens), bcrypt |
| **File Uploads** | Multer (local disk) / Cloudinary (optional) |

---

## Prerequisites

- **Node.js** ≥ 18
- **MongoDB** ≥ 6 running locally (`mongod`) or a MongoDB Atlas connection string
- **npm** ≥ 9

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/UniConnect.git
cd UniConnect
```

### 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env and fill in your actual values (see Environment Variables below)
```

### 3. Frontend setup

```bash
cd ../frontend
npm install
cp .env.example .env
# Edit .env if your backend runs on a different port/host
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Example |
|---|---|---|
| `PORT` | Express server port | `5000` |
| `NODE_ENV` | Environment mode | `development` |
| `MONGO_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/uniconnect` |
| `JWT_SECRET` | Access token signing secret | *(long random string)* |
| `JWT_REFRESH_SECRET` | Refresh token signing secret | *(different long random string)* |
| `JWT_EXPIRE` | Access token TTL | `15m` |
| `JWT_REFRESH_EXPIRE` | Refresh token TTL | `7d` |
| `CLIENT_URL` | Frontend URL for CORS | `http://localhost:5173` |
| `EMAIL_HOST` | SMTP host (optional) | `smtp.example.com` |
| `EMAIL_PORT` | SMTP port | `587` |
| `EMAIL_USER` | SMTP username | `noreply@domain.com` |
| `EMAIL_PASS` | SMTP password | *(secret)* |
| `EMAIL_FROM` | From address | `noreply@uniconnect.dev` |

> **Development tip:** If email is not configured, password reset tokens are logged to the server console.

### Frontend (`frontend/.env`)

| Variable | Description | Example |
|---|---|---|
| `VITE_API_URL` | Backend API base URL | `http://localhost:5000/api` |
| `VITE_SOCKET_URL` | Socket.IO server URL | `http://localhost:5000` |

---

## Running Locally

Start MongoDB first, then run both servers:

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```
Backend will be available at: `http://localhost:5000`

Health check: `http://localhost:5000/api/health`

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```
Frontend will be available at: `http://localhost:5173`

---

## Database Seeding (Optional)

To seed initial communities and an admin user:

```bash
cd backend
npm run seed
```

To seed categories:
```bash
npm run seed:categories
```

---

## Project Structure

```
UniConnect/
├── backend/
│   ├── config/           # Database connection
│   ├── constants/        # App-wide constants
│   ├── controllers/      # Route handler logic
│   ├── helpers/          # Utility helpers
│   ├── middleware/        # Auth, error handling
│   ├── models/           # Mongoose schemas
│   ├── routes/           # Express route definitions
│   ├── scripts/          # Seed scripts
│   ├── services/         # Socket.IO, email, tokens
│   ├── sockets/          # (Socket event handlers)
│   ├── uploads/          # Local file uploads
│   ├── utils/            # Shared utilities
│   ├── validators/       # Input validation
│   ├── app.js            # Express app setup
│   ├── server.js         # HTTP + Socket.IO server entry
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── public/           # Static assets
│   ├── src/
│   │   ├── api/          # Axios API client modules
│   │   ├── assets/       # Images, fonts
│   │   ├── components/   # Reusable UI components
│   │   ├── context/      # React context (Auth, Socket)
│   │   ├── layouts/      # Page layout wrapper
│   │   ├── pages/        # Route page components
│   │   ├── App.jsx       # Router setup
│   │   ├── index.css     # Global styles
│   │   └── main.jsx      # Entry point
│   ├── package.json
│   ├── vite.config.js
│   └── .env.example
│
├── .gitignore
└── README.md
```

---

## Real-Time Chat Architecture

```
React (ChatPage)
  └── SocketContext (socket.io-client)
        └── Socket.IO WebSocket
              └── socketService.js (Node.js)
                    ├── JWT Authentication middleware
                    ├── Conversation membership verification
                    ├── MongoDB message persistence
                    └── Events:
                         join_conversation  →  room subscription
                         send_message       →  persist + broadcast new_message
                         new_message        ←  broadcast to room
                         typing_start/stop  →  relay to room
                         message_read       →  persist read state
                         presence_change    ←  broadcast online users list
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register |
| `POST` | `/api/auth/login` | Login |
| `POST` | `/api/auth/logout` | Logout |
| `POST` | `/api/auth/refresh` | Refresh access token |
| `POST` | `/api/auth/forgot-password` | Request reset email |
| `POST` | `/api/auth/reset-password/:token` | Reset password |
| `GET` | `/api/feed` | Home feed |
| `GET` | `/api/posts/:id` | Post detail |
| `POST` | `/api/posts` | Create post |
| `GET` | `/api/communities` | List communities |
| `POST` | `/api/communities` | Create community |
| `GET` | `/api/chat/conversations` | List conversations |
| `GET` | `/api/chat/conversations/:id/messages` | Message history |
| `GET` | `/api/notifications` | Notifications |
| `GET` | `/api/search` | Search |

---

## Mobile Support

UniConnect is fully responsive from **320px to 1280px+**:

- **≥ 1280px**: Three-column layout (left sidebar + feed + right sidebar)
- **768px–1280px**: Two-column layout (left sidebar + feed)
- **≤ 768px**: Single-column with fixed bottom navigation bar
- **Chat**: Mobile shows conversation list OR chat window, not both squeezed

---

## Security Notes

- JWT access tokens expire in 15 minutes; refresh tokens in 7 days
- Passwords hashed with bcrypt (saltRounds=12)
- Socket.IO connections authenticated with JWT — userId is always determined server-side
- Users can only access conversations they are members of
- No secrets are committed to source control

---

## License

MIT
