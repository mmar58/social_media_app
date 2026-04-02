# Social App

Social App is a full-stack social feed application with authentication, public/private posts, threaded comments, likes, and real-time notifications.

The codebase is split into two runtime applications:

* `frontend/`: Next.js 16 + React 19 application using the App Router.
* `backend/`: Express + TypeScript API with MySQL, Socket.IO, JWT auth, and file uploads.

## What the app currently does

* Registers and logs users in with JWT-based authentication.
* Persists the auth token in the browser and restores the user on reload.
* Loads a cursor-paginated feed of public posts plus the signed-in user's private posts.
* Creates posts with optional image upload and public/private visibility.
* Rejects non-image uploads and images larger than 5 MB on post creation.
* Supports likes on posts and comments.
* Supports top-level comments and replies.
* Pushes notifications in real time for post likes, comments, comment likes, and replies.
* Opens notification details in a focused modal that scrolls to the related post, comment, or reply.
* Loads comment threads lazily per post through a paginated comments endpoint instead of embedding full comment trees in feed reads.
* Live-syncs feed and notification modal updates for post likes, comments, comment likes, and replies.

## Workspace structure

```text
social_app/
|-- backend/
|   |-- src/
|   |   |-- app.ts
|   |   |-- db.ts
|   |   |-- index.ts
|   |   |-- middleware/
|   |   `-- routes/
|   |-- test/
|   |-- uploads/
|   |-- schema.sql
|   `-- package.json
|-- frontend/
|   |-- app/
|   |   |-- components/
|   |   |-- context/
|   |   |-- feed/
|   |   |-- login/
|   |   `-- register/
|   |-- public/
|   |-- test/
|   `-- package.json
|-- docs/
|   |-- ARCHITECTURE.md
|   |-- FEATURE_WORKFLOW.md
|   |-- NOTIFICATIONS.md
|   |-- SCALING.md
|   `-- TESTING.md
|-- static/
|-- ARCHITECTURE_AND_WORKFLOW.md
`-- Selection Task for Full Stack Engineer at Appifylab.md
```

## Quick start

### Prerequisites

* Node.js 20+
* pnpm
* MySQL 8+

### Backend setup


1. Create a MySQL database named `social_app`.
2. Run the schema in `backend/schema.sql`.
3. Copy `backend/.env.example` to `backend/.env` and adjust values.
4. Install dependencies and start the API:

```bash
cd backend
pnpm install
pnpm dev
```

The backend starts on `http://localhost:5000` by default.

### Frontend setup


1. Copy `frontend/.env.example` to `frontend/.env.local` and adjust values if needed.
2. Install dependencies and start the UI:

```bash
cd frontend
pnpm install
pnpm dev
```

The frontend starts on `http://localhost:3000` by default.

## Test commands

Run tests independently in each app:

```bash
cd backend
pnpm test
```

```bash
cd frontend
pnpm test
```

## Multi-user activity scripts

For local real-world effect testing against the running backend, the backend package now includes CLI scripts that can register users, log them in, and generate delayed social activity.

Typical flow:

```bash
cd backend
pnpm sim:register-users --count 8
pnpm sim:login-users
pnpm sim:activity --iterations 0 --delay-ms 2000 --jitter-ms 1500 --image-ratio 0.35
```

What they do:

* `pnpm sim:register-users`: creates multiple users and saves credentials plus tokens to `backend/scripts/social-load/users.generated.json`.
* `pnpm sim:login-users`: refreshes tokens for the saved users.
* `pnpm sim:activity`: continuously creates posts, comments, replies, and likes with a delay until stopped, or for a fixed number of actions.

Useful flags:

* `--base-url http://localhost:5000` to target a non-default backend.
* `--iterations 0` to run endlessly until `Ctrl+C`.
* `--public-ratio 0.85` to control how many generated posts are public.
* `--image-ratio 0.35` to control how many generated posts include an uploaded image.
* `--persist-logins` to rewrite the saved user file with fresh tokens before activity starts.

## Documentation map

* `docs/ARCHITECTURE.md`: system structure, request flow, and runtime boundaries.
* `docs/FEATURE_WORKFLOW.md`: how to add or enable new features safely in this repo.
* `docs/NOTIFICATIONS.md`: current notification design and how to plug any new feature into it.
* `docs/TESTING.md`: test strategy, commands, and how to extend coverage.
* `docs/SCALING.md`: bottlenecks, Redis integration strategy, and a scaling roadmap.

## Important current implementation notes

* The frontend now resolves backend API and socket URLs through `frontend/app/lib/api.ts` and environment variables.
* Feed reads use batched hydration and cursor pagination, and comment threads are fetched separately through `GET /api/posts/:id/comments`.
* Notification creation is centralized in a backend service and supports multiple active sockets per user.
* Feed state, post mutations, and live updates are centralized in `frontend/app/context/PostContext.tsx`, backed by a shared request helper in `frontend/app/lib/request.ts`.
* Post creation upload validation currently allows `jpeg`, `jpg`, `png`, `gif`, and `webp` files up to 5 MB.
* Uploaded files are stored on local disk under `backend/uploads/`.
* Real-time user-to-socket mapping is stored in memory inside the backend process.
* Real-time feed and modal events are still broadcast-oriented rather than room-scoped, which is simple but not yet ideal for privacy or scale.

## Current limitations and improvement scope

The application is now structurally cleaner than the original interview baseline, but the main production-shaping gaps are still these:

* Real-time event delivery is still broadcast-oriented instead of room-scoped per user or post.
* Socket registration is still process-local, so multi-instance deployment would need a shared adapter such as Redis.
* Uploads still use local disk storage instead of object storage and CDN delivery.
* Notifications are still created inline in request handlers rather than through async jobs or an event bus.
* Comment pagination is split from feed reads, but replies are still hydrated together with each loaded top-level comment page.
* The frontend request helper is intentionally lightweight and does not yet replace a full query/cache library.

The next improvements with the highest return are room-based Socket.IO delivery, Redis-backed realtime infrastructure, object storage for uploads, and async notification processing.

## Recommended reading order


1. Start with `docs/ARCHITECTURE.md`.
2. Read `docs/FEATURE_WORKFLOW.md` before adding new functionality.
3. Read `docs/NOTIFICATIONS.md` before wiring alerts or real-time behavior.
4. Read `docs/SCALING.md` before planning production hardening.


