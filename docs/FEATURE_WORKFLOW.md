# Feature Workflow

## Purpose

This document explains how to add or enable new features in the current codebase without breaking the existing frontend, backend, notification flow, or tests.

## Working model in this repository

Most features in this app cross the same five layers:

1. Data model or persistence rules.
2. Backend endpoint or route behavior.
3. Frontend page or component state.
4. Optional real-time update or notification.
5. Automated tests.

The safest way to add a feature is to walk those layers in order.

## Standard implementation sequence

### 1. Define the user behavior first

Before writing code, answer these questions:

- Who triggers the feature?
- Who can see the result?
- Is it read-only, a mutation, or both?
- Does it affect posts, comments, or users?
- Does it need a real-time update?
- Does it need a notification?

If those answers are unclear, the feature usually becomes inconsistent across frontend and backend.

## 2. Decide whether the feature needs schema changes

Use `backend/schema.sql` when the feature needs:

- A new entity.
- A new relation.
- A new notification type.
- A new status field or visibility field.
- New indexing for read-heavy access.

Examples:

- Save posts: likely needs a `saved_posts` table.
- Follow users: likely needs a `follows` table.
- Mute notifications: likely needs a per-user preference table.

## 3. Add or extend the backend route

Most current business logic lives in `backend/src/routes/`.

Typical pattern:

1. Authenticate with `authenticate` middleware when the feature is protected.
2. Read route params and body.
3. Apply database changes with Knex.
4. Return the smallest useful response payload.
5. If another user is affected, create a notification and optionally emit a socket event.

Examples in the current codebase:

- Post like: `backend/src/routes/posts.ts`
- Comment creation: `backend/src/routes/posts.ts`
- Notification detail hydration: `backend/src/routes/notifications.ts`

## 4. Wire the frontend UI

Most user-facing features connect in one of these places:

- Auth/session changes: `frontend/app/context/AuthContext.tsx`
- Feed screen behavior: `frontend/app/feed/page.tsx`
- Shared header or notification UI: `frontend/app/components/Header.tsx`
- Post actions: `frontend/app/components/PostItem.tsx`

Typical frontend sequence:

1. Add the UI control.
2. Call the backend endpoint.
3. Update local component or page state.
4. Reflect loading or error state if needed.
5. Add or update tests.

## 5. Decide whether the feature should be real-time

Current real-time events are lightweight and Socket.IO-based.

Use real-time updates when users expect immediate shared state, for example:

- New public post appears in active feeds.
- Like counts update while others are viewing the same post.
- A notification should appear instantly.

Current socket events:

- `new_post`
- `receive_post`
- `like_post`
- `update_likes`
- `new_comment`
- `receive_comment`
- `like_comment`
- `update_comment_likes`
- `reply_comment`
- `receive_reply`
- `notification`

If a feature is user-targeted rather than broadcast-oriented, prefer a notification event over a broad broadcast.

## 6. Decide whether the feature should be enabled conditionally

The current repository does not have a formal feature-flag system.

### Current practical approach

For small features:

- Add the backend route.
- Add the frontend UI.
- Ship it fully enabled.

### Recommended approach for controlled rollout

If a feature should be turned on or off per environment, introduce a simple feature config module.

Suggested pattern:

```ts
export const featureFlags = {
  reactionsV2: process.env.NEXT_PUBLIC_ENABLE_REACTIONS_V2 === "true",
};
```

Use the same idea on the backend with server-side env variables for API-side gating.

This keeps rollout logic explicit and prevents hidden conditional behavior in components.

## 7. Add tests before considering the feature complete

### Backend

Add API tests when the feature changes:

- Authorization.
- Persistence.
- Feed visibility.
- Notification generation.
- Detail hydration.

Use `backend/test/api.test.ts` and `backend/test/utils/mockDb.ts` as the reference pattern.

### Frontend

Add UI tests when the feature changes:

- Form behavior.
- Fetch payloads.
- State transitions.
- Interaction callbacks.
- Notification rendering or navigation behavior.

Use `frontend/test/auth-pages.test.tsx` and `frontend/test/post-interactions.test.tsx` as the reference pattern.

## Feature checklist

Use this checklist for every new feature:

- The user behavior is defined.
- The schema impact is clear.
- The backend route is added or updated.
- The frontend renders and updates correctly.
- Real-time behavior is intentional, not accidental.
- Notification behavior is explicit.
- Tests cover the happy path and the most important guardrails.
- Documentation is updated.

## Example feature shapes

### Example A: Saved posts

Expected changes:

- Add a `saved_posts` table.
- Add `POST /api/posts/:id/save` and `DELETE /api/posts/:id/save` or a toggle endpoint.
- Add a save button to `PostItem`.
- Add a saved-posts screen or filter.
- Add tests for persistence and UI toggling.
- No notification needed.

### Example B: Follow user

Expected changes:

- Add a `follows` table.
- Add follow and unfollow endpoints.
- Add follow button in profile-oriented UI.
- Decide how feed visibility changes for followed users.
- Add a `followed_you` notification type if the product requires it.
- Add tests for relationship rules and notification behavior.

### Example C: Mention in comment

Expected changes:

- Detect mentions during comment creation.
- Store mention records or compute them during write.
- Create targeted notifications for mentioned users.
- Update the notification renderer and detail view if needed.
- Add tests for multi-user mention behavior.

## Recommended refactor before heavy feature growth

If the product grows beyond a few more features, introduce these application boundaries:

- A shared frontend socket hook or provider so feed and modal updates do not duplicate connection logic.
- A reusable frontend post interaction state layer so feed and modal do not duplicate optimistic updates.
- Shared TypeScript types for API payloads.
- A migration system for schema changes and indexes.

Without those boundaries, each new feature will increase duplication and make regressions easier.