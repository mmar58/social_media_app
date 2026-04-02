# Testing

## Current test stack

### Backend

* Vitest
* Supertest
* Mock database implementation from `backend/test/utils/mockDb.ts`

### Frontend

* Vitest
* React Testing Library
* `@testing-library/user-event`
* jsdom

## Commands

Run the backend tests:

```bash
cd backend
pnpm test
```

Run the frontend tests:

```bash
cd frontend
pnpm test
```

Watch mode is also available in both apps with `pnpm test:watch`.

## What is currently covered

### Backend coverage

`backend/test/api.test.ts` currently verifies:

* user registration.
* duplicate email rejection.
* login success.
* authenticated `me` endpoint behavior.
* public vs private feed visibility.
* post creation.
* likes on posts.
* comments.
* replies.
* notification list and unread counts.
* notification detail hydration.
* mark-one-read and mark-all-read flows.
* feed comment summary fields.
* paginated `GET /api/posts/:id/comments` behavior.
* private-post comment page authorization.

`backend/test/uploads.test.ts` currently verifies:

* rejection of non-image uploads.
* rejection of files larger than 5 MB.

### Frontend coverage

`frontend/test/auth-pages.test.tsx` currently verifies:

* login form submission.
* registration form submission.
* password mismatch validation.
* `useAuth().login()` integration.

`frontend/test/post-interactions.test.tsx` currently verifies:

* post creation callback wiring.
* visibility selection.
* post likes.
* comment submission.
* comment likes.
* replies.
* jump targeting for nested reply display.
* lazy comment loading triggers.
* load-more comment pagination triggers.

`frontend/test/header-notifications.test.tsx` currently verifies:

* notification dropdown rendering.
* mark-read plus detail fetch when opening a notification.
* hydration of the shared post store before opening `NotificationPostModal`.

`frontend/test/postcontext-sockets.test.tsx` currently verifies:

* registration of the shared PostContext socket listeners.
* feed-store updates for `receive_post`, `update_likes`, `receive_comment`, `update_comment_likes`, and `receive_reply`.
* socket listener cleanup on unmount.

## Current gaps

The current test suite is useful, but there are still important untested areas:

* `AuthContext` token restoration and socket registration.
* error paths for failed fetches.
* socket-driven updates in the notification modal.
* search behavior and debounce behavior.
* feed cursor pagination and load-more behavior.
* notification modal focus behavior for targeted comments and replies.
* deeper upload-path coverage beyond MIME and size rejection, such as storage failures.

## How to add backend tests

Use `backend/test/api.test.ts` as the main integration-style pattern.

### Recommended flow


1. Reset mock state in `beforeEach`.
2. Register the minimum number of users needed for the scenario.
3. Drive the feature through real HTTP requests using Supertest.
4. Assert both the response and the final mock database state.

### Add backend tests when a feature changes

* authorization.
* ownership rules.
* visibility rules.
* notification generation.
* response shape.
* data persistence.

## How to add frontend tests

Use the current tests as interaction-level component tests.

### Recommended flow


1. Mock `useAuth` where needed.
2. Mock `fetch` for endpoint calls.
3. Render the page or component.
4. Drive the UI through user-level interactions.
5. Assert visible behavior and callback payloads.

### Add frontend tests when a feature changes

* forms.
* user-triggered actions.
* conditional rendering.
* input validation.
* notification UI.
* auth redirects.

## Testing standards for future changes

Use these rules for this repository:

* Every new backend mutation should have at least one backend test.
* Every new notification type should have a backend creation test and a detail-resolution test if applicable.
* Every new interactive frontend component should have at least one user-path test.
* Every bug fix should add a regression test if the path is testable.

## Suggested next test investments

These will provide the best return first:


1. Add tests for `Header.tsx` notification rendering and mark-read behavior.
1. Add tests for `NotificationPostModal.tsx` focus behavior.
2. Add backend tests for invalid auth and invalid notification ids.
3. Add tests for feed search and debounced fetch behavior.
4. Add tests for feed cursor pagination and load-more behavior through `PostContext`.
5. Add tests for socket-driven comment-like and reply synchronization inside the notification modal.


