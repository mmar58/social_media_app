# Social App

Social App is a full-stack social feed application with authentication, public/private posts, threaded comments, likes, and real-time notifications.

The codebase is split into two runtime applications:

* `frontend/`: Next.js 16 + React 19 application using the App Router.
* `backend/`: Express + TypeScript API with MySQL, Socket.IO, JWT auth, and file uploads.

## What the app currently does

* Registers and logs users in with JWT-based authentication.
* Persists the auth token in the browser and restores the user on reload.
* Loads a feed of public posts plus the signed-in user's private posts.
* Creates posts with optional image upload and public/private visibility.
* Supports likes on posts and comments.
* Supports top-level comments and replies.
* Pushes notifications in real time for post likes, comments, comment likes, and replies.
* Opens notification details in a focused modal that scrolls to the related post, comment, or reply.

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


1. Install dependencies and start the UI:

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

## Documentation map

* `docs/ARCHITECTURE.md`: system structure, request flow, and runtime boundaries.
* `docs/FEATURE_WORKFLOW.md`: how to add or enable new features safely in this repo.
* `docs/NOTIFICATIONS.md`: current notification design and how to plug any new feature into it.
* `docs/TESTING.md`: test strategy, commands, and how to extend coverage.
* `docs/SCALING.md`: bottlenecks, Redis integration strategy, and a scaling roadmap.

## Important current implementation notes

* The frontend currently calls the backend through hard-coded `http://localhost:5000` URLs in several places.
* Uploaded files are stored on local disk under `backend/uploads/`.
* Real-time user-to-socket mapping is stored in memory inside the backend process.
* Feed hydration currently uses multiple per-post queries, which is acceptable for small datasets but not for large-scale traffic.

## Recommended reading order


1. Start with `docs/ARCHITECTURE.md`.
2. Read `docs/FEATURE_WORKFLOW.md` before adding new functionality.
3. Read `docs/NOTIFICATIONS.md` before wiring alerts or real-time behavior.
4. Read `docs/SCALING.md` before planning production hardening.


