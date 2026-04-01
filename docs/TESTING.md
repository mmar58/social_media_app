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

## Current gaps

The current test suite is useful, but there are still important untested areas:

* `AuthContext` token restoration and socket registration.
* notification dropdown rendering in `Header.tsx`.
* notification modal behavior in `NotificationPostModal.tsx`.
* error paths for failed fetches.
* upload validation and file handling edge cases.
* socket-driven updates in the feed UI.
* search behavior and debounce behavior.

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
2. Add tests for `NotificationPostModal.tsx` focus behavior.
3. Add backend tests for invalid auth and invalid notification ids.
4. Add tests for feed search and debounced fetch behavior.
5. Add tests for image upload validation and size limits.


