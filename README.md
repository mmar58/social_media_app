# Social App

A full-stack social feed application built for the **Appifylab Full Stack Engineer Selection Task**.

The codebase is split into two runtime applications:

* `frontend/`: Next.js 16 + React 19 application using the App Router.
* `backend/`: Express + TypeScript API with MySQL, Socket.IO, JWT auth, and file uploads.

## Task requirements coverage

Every requirement from the selection task is implemented:

| Requirement | Status | Notes |
|---|---|---|
| Registration (first name, last name, email, password) | ✅ | Validated on both client and server with Zod |
| Login / logout | ✅ | JWT stored in `httpOnly` cookie; session restored on reload |
| Protected feed route | ✅ | Redirects unauthenticated users to `/login` |
| Create post with text and image | ✅ | Multipart upload, 5 MB limit, image-only enforcement |
| Posts ordered newest first | ✅ | Cursor-paginated, descending by `created_at` |
| Public posts visible to all / private only to author | ✅ | Backend visibility filter on every feed read |
| Like / unlike posts, comments, and replies | ✅ | Toggle endpoint; live-synced state across tabs |
| Comments and replies | ✅ | Threaded via `parent_id`; paginated per post |
| Like / unlike comments and replies | ✅ | Full polymorphic like system |
| Show who has liked a post, comment, or reply | ✅ | Like counts and actor lists returned on hydration |
| Real-time notifications | ✅ | Socket.IO push for likes, comments, replies |
| Best practices for security | ✅ | See Security section below |
| Designed for millions of posts and reads | ✅ | See Architecture section below |

## What the app does

* Registers and logs users in with JWT authentication stored in an `httpOnly` cookie.
* Restores the signed-in session on every page reload through `GET /api/auth/me`.
* Loads a cursor-paginated feed of public posts and the signed-in user's own private posts.
* Creates posts with optional image upload and public/private visibility.
* Rejects non-image uploads and images over 5 MB.
* Supports likes and unlikes on posts and comments.
* Supports top-level comments and threaded replies.
* Pushes real-time notifications for post likes, comments, comment likes, and replies.
* Opens notification details in a focused modal that scrolls to the related comment or reply.
* Loads comment threads lazily per post through a dedicated paginated endpoint.
* Live-syncs feed and notification modal updates across all active browser sessions.

## Security highlights

* JWT stored in `httpOnly`, `SameSite=Lax`, and `secure` (in production) cookies — not in `localStorage`.
* Passwords hashed with `bcryptjs` (cost factor 10).
* All route inputs validated at the boundary with Zod before reaching business logic.
* File uploads restricted to `jpg`, `png`, `gif`, `webp`; MIME type and size enforced by `multer`.
* CORS configured to allow only expected frontend origins; credentials permitted explicitly.
* Optional TLS CA verification for MySQL connections via `DB_SSL_CA` or `DB_SSL_CA_PATH`.
* Auth middleware rejects unauthenticated requests with `401` before any query executes.

## Architecture highlights

* **Cursor-based feed pagination** keeps feed reads fast as the post table grows.
* **Batched post hydration** eliminates per-post N+1 queries by fetching likes, comments, and author metadata in a single batch per page.
* **Comment threads loaded separately** from feed reads so the feed page is never blocked by large comment trees.
* **Centralized notification service** owns row creation, sender hydration, and socket fan-out — keeping route handlers thin and side effects auditable.
* **Explicit database indexes** on common filter and sort columns (`visibility + created_at`, `user_id + created_at`, notification columns).
* **Shared frontend state** in `PostContext` and `AuthContext` ensures the feed card and notification modal always operate on the same record and mutation handlers.
* **Environment-aware URL resolution** in `frontend/app/lib/api.ts` lets the same frontend build work on localhost, LAN IPs, HTTP, and HTTPS without hardcoded origins.

## Workspace structure

```text
social_app/
├── backend/
│   ├── src/
│   │   ├── app.ts              # Express + Socket.IO setup
│   │   ├── db.ts               # Knex MySQL connection (optional SSL)
│   │   ├── middleware/auth.ts  # JWT auth middleware
│   │   ├── routes/             # auth, posts, notifications
│   │   ├── services/           # postHydration, notificationService
│   │   └── validation/         # Zod schemas and middleware
│   ├── test/                   # Vitest + Supertest API tests
│   ├── schema.sql
│   └── package.json
├── frontend/
│   ├── app/
│   │   ├── components/         # Header, PostItem, CreatePostBox, modals
│   │   ├── context/            # AuthContext, PostContext
│   │   ├── lib/                # api.ts, request.ts, assets.ts
│   │   ├── feed/               # feed page
│   │   ├── login/              # login page
│   │   └── register/           # register page
│   ├── test/                   # Vitest + React Testing Library tests
│   └── package.json
├── docs/
│   ├── ARCHITECTURE.md
│   ├── FEATURE_WORKFLOW.md
│   ├── NOTIFICATIONS.md
│   ├── SCALING.md
│   └── TESTING.md
└── static/                     # Original HTML/CSS design templates
```

## Quick start

### Prerequisites

* Node.js 20+
* pnpm
* MySQL 8+

### Backend setup

1. Create a MySQL database named `social_app`.
2. Run the schema: `mysql -u root -p social_app < backend/schema.sql`
3. Copy `backend/.env.example` to `backend/.env` and fill in your values.
4. If your MySQL provider requires TLS, set `DB_SSL_CA` (PEM string) or `DB_SSL_CA_PATH` (file path).
5. Install and start:

```bash
cd backend
pnpm install
pnpm dev
```

The backend starts on `http://localhost:5000` by default.

### Frontend setup

1. Copy `frontend/.env.example` to `frontend/.env.local`.  
   Leave `NEXT_PUBLIC_API_URL` empty to auto-derive the backend from the current hostname, or set it explicitly.
2. Install and start:

```bash
cd frontend
pnpm install
pnpm dev
```

The frontend starts on `http://localhost:3000` by default.  
Access from a LAN IP works automatically — the frontend detects the host and routes API calls to the same IP on port 5000.

## Test commands

```bash
# Backend (Vitest + Supertest)
cd backend && pnpm test

# Frontend (Vitest + React Testing Library)
cd frontend && pnpm test
```

## Multi-user activity scripts

The backend includes CLI scripts for simulating realistic social activity against a running API.

```bash
cd backend
pnpm sim:register-users --count 8
pnpm sim:login-users
pnpm sim:activity --iterations 0 --delay-ms 2000 --jitter-ms 1500 --image-ratio 0.1
```

What they do:

* `sim:register-users` — creates multiple users and saves credentials to `backend/scripts/social-load/users.generated.json`.
* `sim:login-users` — refreshes tokens for the saved users.
* `sim:activity` — continuously creates posts, comments, replies, and likes until stopped or a fixed iteration count is reached.

Key flags:

| Flag | Default | Description |
|---|---|---|
| `--base-url` | `http://localhost:5000` | Target backend URL |
| `--iterations` | `20` | `0` to run until Ctrl+C |
| `--public-ratio` | `0.85` | Fraction of posts that are public |
| `--image-ratio` | `0.35` | Fraction of posts with an uploaded image |
| `--delay-ms` | `1000` | Base delay between actions |
| `--persist-logins` | false | Rewrite saved file with fresh tokens |

## Documentation map

| File | Contents |
|---|---|
| `docs/ARCHITECTURE.md` | System structure, request flows, database model |
| `docs/FEATURE_WORKFLOW.md` | How to safely add new features |
| `docs/NOTIFICATIONS.md` | Notification design and extension guide |
| `docs/SCALING.md` | Bottlenecks, Redis plan, and scaling phases |
| `docs/TESTING.md` | Test strategy, commands, and coverage gaps |

## Design decisions and trade-offs

**Why `httpOnly` cookies instead of `localStorage` for JWT?**
`localStorage` is accessible to any JavaScript on the page, making it an XSS target. An `httpOnly` cookie is invisible to JavaScript and sent automatically by the browser, removing the most common token-theft vector.

**Why cursor pagination instead of offset?**
`OFFSET N` on large tables forces the database to scan and discard `N` rows on every page request. A cursor (`WHERE id < :cursor`) uses the primary key index directly and stays fast regardless of how many rows exist.

**Why batched post hydration?**
Loading each post's likes, comments, and author info individually creates N+1 query patterns. Batching collects all post ids from a page and resolves related data in a single query per concern, keeping feed reads efficient at any page size.

**Why a dedicated notification service instead of inline route logic?**
Centralizing notification creation makes it easy to add new notification types, enforce the "no self-notification" rule in one place, and replace inline delivery with an async job queue in the future without touching route handlers.

**Why keep uploads local for now?**
Object storage (S3) is the right production target, but it adds infrastructure complexity orthogonal to demonstrating the core feature set. The upload route is isolated behind `multer` and can be swapped with a storage adapter in one file.

## Current known limitations

* Real-time events are broadcast-oriented — all connected clients receive them. Room-based delivery scoped by user or post is the right next step.
* Socket registration is process-local. Multi-instance deployment needs a Redis Socket.IO adapter.
* Uploads use local disk storage. A production deployment should use S3-compatible object storage with CDN delivery.
* Notifications are created synchronously inside route handlers. An async job queue (e.g. BullMQ) would decouple user-facing latency from side effects.

