# Scaling

## Goal

This document explains how to evolve the current implementation into a system that can handle very large traffic, including millions of users.

The current codebase is a strong functional base, but it is not yet production-shaped for that scale.

## Current bottlenecks

## Implemented in this repository

The codebase now includes a first round of low-cost scaling improvements:

- batched post hydration for feed reads instead of route-level per-post N+1 queries.
- cursor-based feed pagination using post ids.
- explicit indexes in `backend/schema.sql` for hot read and notification paths.
- centralized notification writes and socket fan-out in a backend service.
- environment-based frontend API and socket configuration.
- request validation for auth and post-related routes.

### Backend query shape

Older versions of `backend/src/routes/posts.ts` loaded posts first and then ran additional queries for each post to fetch likes, comments, and comment likes.

That route has now been refactored to batch related reads, but the underlying concern is still the right one for future expansion:

- post count grows.
- comments per post grow.
- concurrent readers grow.

### Missing explicit indexes

The schema now includes explicit indexes for the most common filters and sorts.

Suggested indexes:

```sql
CREATE INDEX idx_posts_user_created ON posts (user_id, created_at DESC);
CREATE INDEX idx_posts_visibility_created ON posts (visibility, created_at DESC);
CREATE INDEX idx_comments_post_created ON comments (post_id, created_at ASC);
CREATE INDEX idx_comments_parent_created ON comments (parent_id, created_at ASC);
CREATE INDEX idx_likes_target ON likes (target_type, target_id);
CREATE INDEX idx_notifications_user_read_created ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_user_created ON notifications (user_id, created_at DESC);
```

### In-memory socket map

`backend/src/app.ts` stores `userId -> Set<socketId>` in a process-local map. That is better for multi-device support on a single node, but it still breaks down when:

- the process restarts.
- multiple backend instances run behind a load balancer.
- a shared delivery layer is needed across regions.

### Broadcast-style real-time events

Several feed synchronization events are still broadcast-oriented rather than room-scoped.

That creates two problems:

- unnecessary fan-out to clients that should not care about the event.
- weak authorization boundaries for future private or follower-only content models.

The next real-time hardening step should be moving to room-based delivery keyed by user id and, where needed, post id.

### Duplicated client-side socket consumers

The feed and notification modal currently maintain separate socket connections and duplicate parts of the same live-update logic.

That is acceptable for this scope, but a shared socket provider or event store would be a cleaner next step.

### Local file storage

Uploads are stored under `backend/uploads/` on the local server disk. That makes horizontal scaling difficult because files are not shared across instances.

### Hard-coded URLs

The frontend now resolves API and socket endpoints from environment variables instead of hard-coding `http://localhost:5000` throughout the component tree.

### No caching layer

Every feed and notification read hits the database directly.

### No background job layer

Notifications are created inline inside the request path. That is simple, but it couples user-facing latency to side effects.

## What Redis should do first

Redis is useful here, but only when attached to specific responsibilities.

## 1. Shared Socket.IO adapter

Use Redis as the transport for Socket.IO across multiple backend instances.

Benefits:

- real-time events work across nodes.
- user connections are not tied to a single process.
- horizontal scaling becomes possible.

Recommended direction:

- `@socket.io/redis-adapter`
- publish events to rooms keyed by user id, not only socket ids

## 2. Notification fan-out and event pub/sub

Instead of emitting directly from route handlers, publish domain events such as:

- `post.liked`
- `post.commented`
- `comment.replied`

Then let a notification worker consume those events and handle:

- notification row creation.
- socket delivery.
- email or push notifications in the future.

Benefits:

- faster API response paths.
- retry support.
- easier auditing.

## 3. Hot read caching

Redis can cache:

- feed pages.
- post hydration snapshots.
- unread notification counts.
- user profile summaries.

Be careful to cache read models rather than raw mutable entities without invalidation rules.

## 4. Rate limiting

Use Redis-backed rate limiting for:

- login attempts.
- comment spam.
- like spam.
- upload abuse.
- notification-heavy actions.

## 5. Job queues

Use Redis with BullMQ or a similar queue for:

- notification processing.
- media processing.
- image resizing.
- email sending.
- feed fan-out jobs.

## Recommended production architecture

### Phase 1: harden the monolith

Keep one backend codebase, but improve it:

- add indexes.
- add cursor pagination.
- centralize notification logic.
- move uploads to object storage.
- centralize API base URLs in config.
- add structured logs and metrics.

This should happen before introducing multiple services.

### Phase 2: make real-time and reads horizontally scalable

- run multiple backend instances.
- add Redis for Socket.IO and caching.
- store files in S3-compatible object storage.
- place a CDN in front of public assets and uploads.
- add MySQL read replicas for read-heavy paths.

### Phase 3: move heavy side effects out of request handlers

- publish domain events.
- process notifications asynchronously.
- build dedicated workers.
- precompute hot feed summaries.

### Phase 4: optimize for very large social graphs

For millions of users, feed construction becomes the hard problem.

At that scale, you typically need:

- a clear feed strategy, either fan-out on write, fan-out on read, or a hybrid.
- precomputed feed edges for hot users.
- denormalized read models.
- ranking services or ranking jobs.
- strong observability around hot posts and viral spikes.

## Non-Redis improvements that also matter

Redis helps, but it is not the whole answer.

### Database improvements

- add proper indexes.
- add cursor-based pagination instead of fixed `limit=50` only.
- split write and read traffic when needed.
- avoid loading full comment trees for every feed read.

### Storage improvements

- move uploads to object storage.
- serve media through a CDN.
- generate multiple image sizes.

### Application improvements

- introduce backend services for posts, hydration, and notifications.
- introduce a frontend API client instead of repeated raw fetch calls.
- unify frontend socket consumption behind a shared provider or hook.
- centralize post mutation state updates so feed and modal do not drift.
- add request validation.
- add rate limiting.
- add retry-aware async jobs.

### Observability improvements

- request logs.
- structured error logs.
- metrics for read latency, write latency, notification lag, socket count, and queue depth.
- tracing for feed generation and notification workflows.

## Practical roadmap for this repository

If the goal is to turn this project into a scalable foundation, take these steps in order:

1. Add indexes and cursor pagination.
2. Extract notification creation into a service.
3. Move uploads to object storage.
4. Introduce environment-based frontend API configuration.
5. Add Redis for Socket.IO and rate limiting.
6. Add a job queue for notifications and media tasks.
7. Refactor feed hydration away from N+1 queries.
8. Add caching for hot reads and unread counts.
9. Add read replicas and deployment automation.
10. Revisit feed architecture for high-fanout users.

The repository now covers items 1, 2, 4, and 7 in the current monolith.

## Bottom line

To support millions of users, the biggest changes are not cosmetic. They are architectural:

- shared real-time infrastructure.
- cached and paginated read paths.
- asynchronous side effects.
- object storage and CDN delivery.
- stronger database design.

Redis should be one important piece of that plan, not the only one.