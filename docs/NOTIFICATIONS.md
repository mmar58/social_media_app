# Notifications

## Current notification model

Notifications are generated on the backend when one user performs an action that matters to another user.

The current notification types are:

- `like_post`
- `like_comment`
- `comment`
- `reply`

These are persisted in the `notifications` table and then pushed over Socket.IO when the target user is connected.

## Current end-to-end flow

### 1. A user triggers an action

Examples already implemented in `backend/src/routes/posts.ts`:

- Liking a post.
- Commenting on a post.
- Liking a comment.
- Replying to a comment.

## 2. The backend creates a notification record

Current pattern:

1. Read the recipient entity, for example the post owner or comment owner.
2. Skip notification creation if the actor and recipient are the same user.
3. Insert a row into `notifications`.
4. Query the sender profile information.
5. Build a socket payload.
6. Emit the event to the connected socket if available.

The payload currently sent to the client looks like this:

```json
{
  "id": 123,
  "user_id": 2,
  "sender_id": 9,
  "type": "comment",
  "target_id": 456,
  "is_read": false,
  "created_at": "2026-04-02T10:15:00.000Z",
  "senderName": "Taylor Tester",
  "senderProfile": "https://example.com/avatar.png"
}
```

## 3. The frontend receives the event

`frontend/app/context/AuthContext.tsx`:

- registers the signed-in user on the socket with `register`.
- listens for `notification` events.
- prepends the notification to `notifications` state.
- increments the `unread` counter.

## 4. The header renders notifications

`frontend/app/components/Header.tsx`:

- shows the unread badge on the bell icon.
- lets the user filter between all and unread.
- lets the user mark all notifications as read.
- lets the user open a notification.

## 5. Opening a notification fetches details

The frontend performs two calls:

1. `POST /api/notifications/:id/read`
2. `GET /api/notifications/:id/details`

The detail endpoint resolves:

- the related post.
- the focused comment id when the notification targets a comment.
- the focused reply id when the notification targets a reply.

The frontend then opens `NotificationPostModal` and scrolls to the relevant element.

While that modal is open, it also listens for live post, comment, comment-like, and reply events so the preview stays current.

## How to connect notifications from any new feature

Use the steps below whenever a new feature should notify another user.

## Step 1: define the notification contract

For any new feature, write down:

- Who is the actor?
- Who is the recipient?
- What entity is the notification about?
- What should `target_id` point to?
- Can the frontend open a meaningful detail view from that target?

Good `target_id` values are ids that let the system reconstruct the relevant context later.

Examples:

- Follow notification: target could be the follower relationship id or sender user id.
- Mention notification: target should point to the comment or reply containing the mention.
- Share notification: target should point to the shared post id or the share record id.

## Step 2: extend the backend type system and schema if needed

If the new notification does not fit the existing enum values, update the schema definition so the new type can be stored.

Examples of future types:

- `followed_you`
- `mentioned_you`
- `post_shared`
- `post_approved`

## Step 3: create the notification in the write path

After the core database mutation succeeds:

1. Resolve the recipient.
2. Avoid self-notifications unless the product explicitly wants them.
3. Insert into `notifications`.
4. Resolve sender info.
5. Emit the `notification` socket payload.

That is the current pattern in `backend/src/routes/posts.ts`.

## Step 4: update the frontend renderer

When a new type is added, update the notification message mapping in `frontend/app/components/Header.tsx`.

That component is where the readable text is generated for each notification type.

## Step 5: update notification detail resolution

If the new notification should open a meaningful detail modal, extend `GET /api/notifications/:id/details` in `backend/src/routes/notifications.ts`.

That route should answer:

- Which post should be loaded?
- Which comment should be focused?
- Which reply should be focused?
- Or should the feature route somewhere else entirely?

If the new notification does not belong in the post modal, it may be better to navigate to a dedicated page instead.

## Step 6: add tests

At minimum add:

- a backend test proving the new action creates the notification.
- a backend test proving detail resolution works.
- a frontend test proving the notification label renders correctly if the UI behavior changed.

## Current backend service shape

The notification creation path is centralized in `backend/src/services/notificationService.ts`. That removes the previous duplication from post, comment, like, and reply handlers.

The current service already owns:

- notification row creation.
- sender hydration.
- socket fan-out to all currently connected sockets for a user.

This keeps the route handlers focused on the write operation itself and makes future async or analytics work easier to add.

The earlier route-level duplication was manageable at small scale, but it would become brittle as more features were added.

The service currently follows this shape:

```ts
await createNotification(app, {
  recipientUserId,
  senderUserId,
  type,
  targetId,
});
```

That service should own:

- notification row creation.
- sender hydration.
- socket lookup.
- event emission.
- future analytics or job dispatching.

## Recommended detail strategy for future features

Use one of these patterns explicitly:

- Post-scoped notification: open `NotificationPostModal`.
- User-scoped notification: route to a profile page.
- System notification: open a dedicated settings or inbox screen.
- Large-scale async notification: show the notification only in the list and defer heavy detail loading until the user asks.

## Current limitations

- Socket targeting uses an in-memory `Map<number, Set<string>>` in `backend/src/app.ts`.
- Notification preview still depends on post-centric detail hydration.
- The header notification renderer only supports the current four notification types.
- Feed and notification modal sync currently rely on broadcast-style socket events rather than authorization-aware rooms.
- Notification side effects still run inline in request handlers instead of through a queue or event bus.

Those limitations are fine for the current app, but future features should not keep copying the same route-level pattern forever.