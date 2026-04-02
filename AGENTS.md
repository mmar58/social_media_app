# Project Agent Guide

## Overview

This repository is a full-stack social feed application with two runnable apps:

- `frontend/`: Next.js 16 and React 19 client for authentication, feed rendering, post creation, notifications, and interaction flows.
- `backend/`: Express and TypeScript API with MySQL, JWT auth, uploads, validation, feed hydration, and Socket.IO fan-out.

The product supports registration, login, public and private posts, likes, comments, replies, notification detail previews, and realtime updates.

## Repository Layout

- `frontend/app/`: pages, contexts, components, and frontend request utilities.
- `frontend/public/assets/`: CSS, images, fonts, and JS carried forward from the original static templates.
- `frontend/test/`: Vitest and React Testing Library coverage for auth and post interactions.
- `backend/src/routes/`: auth, posts, and notifications endpoints.
- `backend/src/services/`: post hydration and notification creation logic.
- `backend/src/validation/`: shared Zod-based validation helpers and schemas.
- `backend/test/`: Vitest and Supertest-style API coverage using the mock DB helpers.
- `docs/`: current architecture, notifications, scaling, feature workflow, and testing notes.
- `static/`: source static HTML and assets that informed the current UI.

## Source Of Truth

Use this priority order when making changes:

1. Current application code in `frontend/` and `backend/`.
2. `README.md`.
3. `docs/ARCHITECTURE.md`, `docs/FEATURE_WORKFLOW.md`, `docs/NOTIFICATIONS.md`, and `docs/TESTING.md`.

Treat `ARCHITECTURE_AND_WORKFLOW.md` as historical context, not authoritative implementation guidance. It still describes parts of the frontend as Tailwind-based, which does not match the current code.

## Cross-App Rules

- Keep frontend and backend contracts aligned. If response shapes, socket payloads, or route semantics change, update both sides together.
- Do not hardcode API hosts in app code. The frontend should resolve backend URLs through `frontend/app/lib/api.ts`.
- Preserve the current notification contract across both apps: notification list items are light-weight, and the detailed post payload is loaded through `GET /api/notifications/:id/details`.
- Preserve the current post hydration model. Feed cards and notification modal views should continue to share the same hydrated post shape.
- Keep validation at the route boundary in the backend through the existing Zod validation helpers.

## Frontend Notes

- Read `frontend/AGENTS.md` before editing files under `frontend/`.
- The frontend is App Router based, but it is primarily a client-side application using shared React contexts.
- Styling is driven by Bootstrap and legacy CSS assets, not by Tailwind utility classes.

## Backend Notes

- `backend/src/app.ts` wires the Express app, static uploads, Socket.IO server, and in-memory socket registration map.
- `backend/src/routes/posts.ts` is the core feature surface for feed loading, post creation, likes, comments, replies, and upload handling.
- `backend/src/routes/notifications.ts` handles notification listing, read state, and focused detail hydration.
- `backend/src/services/notificationService.ts` and `backend/src/services/postHydration.ts` are the preferred extension points for notification fan-out and response shaping.
- Upload handling currently stores files on local disk under `backend/uploads/` and enforces a 5 MB limit with image type checks.

## Testing Expectations

- Backend tests run with `pnpm test` in `backend/`.
- Frontend tests run with `pnpm test` in `frontend/`.
- Add backend tests for backend mutations, visibility rules, auth changes, validation changes, and notification behavior.
- Add frontend tests for new interactive UI paths, auth flows, notification UI behavior, and post interaction regressions.

## Practical Guidance

- Prefer focused fixes that keep existing architecture intact.
- Avoid broad refactors unless the task explicitly calls for them.
- When a change affects realtime events, pagination, or notification targeting, verify both initial load behavior and follow-up interactions.
- When documentation and code disagree, follow the code and update the docs if the mismatch matters to future contributors.
