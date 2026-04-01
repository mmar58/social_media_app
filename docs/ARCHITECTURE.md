# Architecture

## Overview

The repository is a two-application system:

- The frontend is a Next.js App Router application that renders login, registration, and feed pages.
- The backend is an Express API that handles authentication, posts, comments, likes, notifications, uploads, and Socket.IO events.

At runtime the browser talks to the backend over both HTTP and WebSocket connections:

```text
Browser
  |-- HTTP --> Next.js frontend on :3000
  |-- HTTP --> Express API on :5000
  `-- WS   --> Socket.IO server on :5000
```

## Technology stack

| Layer | Current stack | Responsibility |
| --- | --- | --- |
| Frontend | Next.js 16, React 19, TypeScript | Pages, components, auth session state, feed UI, notification UI |
| Backend | Express, TypeScript, Socket.IO | REST API, WebSocket events, JWT auth, uploads |
| Data | MySQL, Knex | Relational storage for users, posts, comments, likes, notifications |
| Auth | JWT, bcryptjs | Login, registration, route protection |
| Testing | Vitest, Supertest, React Testing Library | Backend API tests and frontend interaction tests |

## Runtime structure

### Frontend

The main frontend files are:

- `frontend/app/layout.tsx`: global layout, CSS imports, provider mounting.
- `frontend/app/Providers.tsx`: wraps the app with the auth provider.
- `frontend/app/page.tsx`: redirects the root route to `/feed`.
- `frontend/app/login/page.tsx`: login screen.
- `frontend/app/register/page.tsx`: registration screen.
- `frontend/app/feed/page.tsx`: authenticated feed screen.
- `frontend/app/context/AuthContext.tsx`: user state, token state, notification state, and socket registration.
- `frontend/app/components/Header.tsx`: search, notification dropdown, and user menu.
- `frontend/app/components/CreatePostBox.tsx`: post creation form.
- `frontend/app/components/PostItem.tsx`: post card with likes, comments, replies, and jump targeting.
- `frontend/app/components/NotificationPostModal.tsx`: focused post modal opened from notification clicks.

### Backend

The main backend files are:

- `backend/src/index.ts`: process entrypoint and server startup.
- `backend/src/app.ts`: Express app construction, Socket.IO server setup, route mounting, in-memory socket map.
- `backend/src/db.ts`: Knex MySQL connection.
- `backend/src/middleware/auth.ts`: JWT authentication middleware.
- `backend/src/routes/auth.ts`: register, login, and current-user endpoints.
- `backend/src/routes/posts.ts`: feed retrieval, post creation, likes, comments, and replies.
- `backend/src/routes/notifications.ts`: notification list, read state, and detail hydration.

## Database model

The backend schema is defined in `backend/schema.sql`.

### Core tables

- `users`: profile and authentication data.
- `posts`: post content, visibility, and optional uploaded image path.
- `comments`: top-level comments and replies using `parent_id`.
- `likes`: polymorphic likes for posts and comments.
- `notifications`: user-targeted notifications produced by actions in the system.

### Relationships

```text
users 1 --- * posts
users 1 --- * comments
users 1 --- * likes
users 1 --- * notifications (recipient via user_id)
users 1 --- * notifications (actor via sender_id)

posts 1 --- * comments
comments 1 --- * comments (reply chain via parent_id)
```

## Current request and event flows

### Authentication flow

1. The user submits login or registration in the frontend.
2. The frontend calls `POST /api/auth/login` or `POST /api/auth/register`.
3. The backend returns a JWT and user payload.
4. `AuthContext` stores the token in `localStorage`, updates React state, and routes to `/feed`.
5. On later page loads, `AuthContext` reads the token and validates it through `GET /api/auth/me`.

### Feed load flow

1. `frontend/app/feed/page.tsx` checks auth state.
2. If the user exists, it fetches `GET /api/posts?limit=50`.
3. The backend returns posts with author metadata, likes, comment trees, and comment-like state.
4. The frontend renders the result using `PostItem` components.

### Post and interaction flow

1. `CreatePostBox` submits `multipart/form-data` to `POST /api/posts`.
2. `PostItem` triggers likes, comments, comment likes, and replies through dedicated mutation endpoints.
3. Backend route handlers persist the mutation and return the minimal payload needed by the UI.
4. For public posts and comments, the frontend also emits socket events to update other clients.

### Notification flow

1. A backend route inserts a record into `notifications` when an action targets another user.
2. The backend resolves the recipient socket from `socketMap` and emits a `notification` event.
3. `AuthContext` prepends the notification to local state and increments `unread`.
4. The header renders the notification list and unread badge.
5. Opening a notification marks it read and fetches `GET /api/notifications/:id/details`.
6. The frontend displays the hydrated post in `NotificationPostModal` and scrolls to the relevant comment or reply if needed.

## Current project structure by concern

### UI and state

- Routing is page-based inside `frontend/app/`.
- Session and notification state are centralized in `AuthContext`.
- Feed state is local to `frontend/app/feed/page.tsx`.
- Component composition is simple and direct; there is no global client-side data layer like React Query.

### API and business logic

- Route handlers currently mix validation, persistence, and notification emission in the same file.
- Notification creation is repeated in `backend/src/routes/posts.ts` instead of being centralized in a service.
- The notification details route contains a `hydratePost` helper that duplicates some feed hydration logic.

## Honest current limitations

The codebase works as a functional product, but its current implementation is optimized for simplicity rather than scale:

- Feed hydration uses N+1 queries.
- There is no cursor pagination.
- Uploads are stored on the local filesystem.
- Socket registration is kept in process memory.
- API URLs are hard-coded in the frontend instead of being centralized through environment-aware config.

Those limitations are expected in an interview-sized or early-stage implementation. The scaling plan is documented in `docs/SCALING.md`.