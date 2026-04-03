<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Frontend Agent Guide

## Scope

This folder contains the Next.js 16 frontend for the social app. The UI is an App Router application, but most of the product behavior is implemented in client components and shared React context rather than server components or server actions.

Use this file when changing anything under `frontend/`.

## Architecture That Matters

- `app/layout.tsx` loads the global providers and the legacy stylesheet bundle from `public/assets/css/`.
- `app/page.tsx` immediately redirects `/` to `/feed`.
- `app/context/AuthContext.tsx` owns the authenticated user, cookie-backed session restoration, notifications, unread count, and the main Socket.IO client.
- `app/context/PostContext.tsx` owns feed state, post hydration in the client, likes, comments, replies, comment pagination, and socket-driven feed updates.
- `app/components/Header.tsx` owns search input behavior plus the notification dropdown and notification detail loading.
- `app/components/NotificationPostModal.tsx` renders notification-focused post details by reusing `PostContext` state.
- `app/lib/api.ts` is the only place that should define API and socket base URLs.
- `app/lib/request.ts` is the shared fetch helper with GET deduplication, short-lived cache, and retry behavior.

## Frontend Rules

- Do not hardcode backend URLs in application code. Use `app/lib/api.ts` helpers.
- Prefer `requestJson` over raw `fetch` for normal JSON requests so retries, dedupe, and caching stay consistent.
- Keep auth, notification, and feed state in the existing contexts. Do not introduce duplicate local sources of truth for the same post or notification data.
- Reuse `PostContext` mutation methods from components instead of making ad hoc request logic inside presentational components.
- Keep the notification flow aligned with current behavior: `Header.tsx` loads notification details, upserts the post into `PostContext`, and `NotificationPostModal.tsx` reads from shared post state.
- Preserve existing socket event names unless the backend changes in lockstep: `register`, `notification`, `new_post`, `receive_post`, `like_post`, `update_likes`, `new_comment`, `receive_comment`, `like_comment`, `update_comment_likes`, `reply_comment`, `receive_reply`.

## Styling Rules

- This frontend is not Tailwind-driven today. Tailwind is installed, but the shipped UI uses Bootstrap plus legacy CSS files from `public/assets/css/` and local overrides in `app/globals.css`.
- Prefer the existing class structure and visual patterns when editing the current pages.
- Avoid mixing in a new styling system unless the task is an intentional migration.
- Use assets from `public/assets/` and keep the existing design language unless the task explicitly asks for a redesign.

## Auth And Routing

- Authentication is cookie-backed. The backend sets an `httpOnly` auth cookie, `AuthContext` restores the session through `GET /api/auth/me`, and authenticated requests rely on `credentials: "include"`.
- The feed route protects itself in the client and redirects unauthenticated users to `/login`.
- Login and registration pages call `useAuth().login()` after successful API responses.

## Data And Realtime Constraints

- Feed responses are cursor-paginated and searchable. Preserve `nextCursor`, `hasMore`, and comment pagination behavior when changing feed queries.
- Comment threads load lazily per post. Do not eagerly expand every post unless the requirement changes.
- Notification details depend on backend-hydrated post data plus `focusCommentId` and `focusReplyId` targeting.
- The current app keeps a single auth-owned socket for notifications and feed updates. Avoid adding extra socket connections unless the change genuinely requires it.

## Tests

- Frontend tests use Vitest, React Testing Library, and `@testing-library/user-event`.
- Existing coverage focuses on auth pages and post interactions. Add or update tests when changing forms, interaction flows, notification UI, redirects, or post/comment behavior.
- Run `pnpm test` in `frontend/` after meaningful frontend behavior changes.

## Trust Order

- Trust the current code in `app/` first.
- Trust `README.md` and `../docs/ARCHITECTURE.md` second.
- Treat `../ARCHITECTURE_AND_WORKFLOW.md` carefully: parts of it describe an older frontend approach and should not override the current code.
