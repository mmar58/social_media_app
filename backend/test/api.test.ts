import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/db", async () => {
  const module = await import("./utils/mockDb");
  return { default: module.default };
});

import { createApp } from "../src/app";
import { getMockState, resetMockDb } from "./utils/mockDb";

process.env.JWT_SECRET = "test-secret";

describe("backend api", () => {
  beforeEach(() => {
    resetMockDb();
  });

  async function registerUser(payload: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
  }) {
    const { app } = createApp();
    const response = await request(app).post("/api/auth/register").send(payload);
    expect(response.status).toBe(200);
    return response.body as { token: string; user: { id: number; email: string } };
  }

  it("registers and logs in multiple users", async () => {
    const { app } = createApp();

    const alice = await request(app).post("/api/auth/register").send({
      first_name: "Alice",
      last_name: "Adams",
      email: "alice@example.com",
      password: "password123",
    });
    const bob = await request(app).post("/api/auth/register").send({
      first_name: "Bob",
      last_name: "Baker",
      email: "bob@example.com",
      password: "password456",
    });

    expect(alice.status).toBe(200);
    expect(bob.status).toBe(200);
    expect(alice.body.user.id).not.toBe(bob.body.user.id);

    const duplicate = await request(app).post("/api/auth/register").send({
      first_name: "Alice",
      last_name: "Again",
      email: "alice@example.com",
      password: "password123",
    });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.message).toBe("Email already taken");

    const login = await request(app).post("/api/auth/login").send({
      email: "bob@example.com",
      password: "password456",
    });
    expect(login.status).toBe(200);
    expect(login.body.user.email).toBe("bob@example.com");

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("bob@example.com");
  });

  it("returns the correct feed for owners and other users", async () => {
    const { app } = createApp();
    const alice = await registerUser({
      first_name: "Alice",
      last_name: "Adams",
      email: "alice@example.com",
      password: "password123",
    });
    const bob = await registerUser({
      first_name: "Bob",
      last_name: "Baker",
      email: "bob@example.com",
      password: "password456",
    });

    const publicPost = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ content: "Public update", visibility: "public" });
    const privatePost = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ content: "Private update", visibility: "private" });

    expect(publicPost.status).toBe(200);
    expect(privatePost.status).toBe(200);

    const bobFeed = await request(app)
      .get("/api/posts")
      .set("Authorization", `Bearer ${bob.token}`);
    expect(bobFeed.status).toBe(200);
    expect(bobFeed.body.posts).toHaveLength(1);
    expect(bobFeed.body.posts[0].content).toBe("Public update");

    const aliceFeed = await request(app)
      .get("/api/posts")
      .set("Authorization", `Bearer ${alice.token}`);
    expect(aliceFeed.status).toBe(200);
    expect(aliceFeed.body.posts).toHaveLength(2);
    expect(aliceFeed.body.posts.map((post: any) => post.content)).toEqual([
      "Private update",
      "Public update",
    ]);
  });

  it("supports likes, comments, replies, and notification flows across users", async () => {
    const { app } = createApp();
    const alice = await registerUser({
      first_name: "Alice",
      last_name: "Adams",
      email: "alice@example.com",
      password: "password123",
    });
    const bob = await registerUser({
      first_name: "Bob",
      last_name: "Baker",
      email: "bob@example.com",
      password: "password456",
    });
    const charlie = await registerUser({
      first_name: "Charlie",
      last_name: "Clark",
      email: "charlie@example.com",
      password: "password789",
    });

    const createdPost = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ content: "Team update", visibility: "public" });
    expect(createdPost.status).toBe(200);
    const postId = createdPost.body.post.id;

    const bobComment = await request(app)
      .post(`/api/posts/${postId}/comment`)
      .set("Authorization", `Bearer ${bob.token}`)
      .send({ content: "Nice work" });
    expect(bobComment.status).toBe(200);
    const bobCommentId = bobComment.body.comment.id;

    const aliceCommentLike = await request(app)
      .post(`/api/posts/${postId}/comments/${bobCommentId}/like`)
      .set("Authorization", `Bearer ${alice.token}`);
    expect(aliceCommentLike.status).toBe(200);
    expect(aliceCommentLike.body.action).toBe("liked");

    const aliceComment = await request(app)
      .post(`/api/posts/${postId}/comment`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ content: "Thanks everyone" });
    expect(aliceComment.status).toBe(200);
    const aliceCommentId = aliceComment.body.comment.id;

    const bobReply = await request(app)
      .post(`/api/posts/${postId}/comments/${aliceCommentId}/reply`)
      .set("Authorization", `Bearer ${bob.token}`)
      .send({ content: "Following up" });
    expect(bobReply.status).toBe(200);
    const bobReplyId = bobReply.body.reply.id;

    const charlieLike = await request(app)
      .post(`/api/posts/${postId}/like`)
      .set("Authorization", `Bearer ${charlie.token}`);
    expect(charlieLike.status).toBe(200);
    expect(charlieLike.body.action).toBe("liked");

    const aliceNotifications = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${alice.token}`);
    expect(aliceNotifications.status).toBe(200);
    expect(aliceNotifications.body.unread).toBe(3);
    expect(aliceNotifications.body.notifications).toHaveLength(3);
    expect(aliceNotifications.body.notifications.map((item: any) => item.type).sort()).toEqual([
      "comment",
      "like_post",
      "reply",
    ]);

    const replyNotification = aliceNotifications.body.notifications.find((item: any) => item.type === "reply");
    const replyDetails = await request(app)
      .get(`/api/notifications/${replyNotification.id}/details`)
      .set("Authorization", `Bearer ${alice.token}`);
    expect(replyDetails.status).toBe(200);
    expect(replyDetails.body.focusCommentId).toBe(aliceCommentId);
    expect(replyDetails.body.focusReplyId).toBe(bobReplyId);
    expect(replyDetails.body.post.id).toBe(postId);

    const bobNotifications = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${bob.token}`);
    expect(bobNotifications.status).toBe(200);
    expect(bobNotifications.body.notifications.map((item: any) => item.type)).toEqual(["like_comment"]);

    const likeCommentNotification = bobNotifications.body.notifications[0];
    const likeCommentDetails = await request(app)
      .get(`/api/notifications/${likeCommentNotification.id}/details`)
      .set("Authorization", `Bearer ${bob.token}`);
    expect(likeCommentDetails.status).toBe(200);
    expect(likeCommentDetails.body.focusCommentId).toBe(bobCommentId);
    expect(likeCommentDetails.body.focusReplyId).toBeNull();

    const markReplyRead = await request(app)
      .post(`/api/notifications/${replyNotification.id}/read`)
      .set("Authorization", `Bearer ${alice.token}`);
    expect(markReplyRead.status).toBe(200);

    const markAllRead = await request(app)
      .post("/api/notifications/mark-all-read")
      .set("Authorization", `Bearer ${alice.token}`);
    expect(markAllRead.status).toBe(200);

    const finalAliceNotifications = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${alice.token}`);
    expect(finalAliceNotifications.body.unread).toBe(0);
    expect(finalAliceNotifications.body.notifications.every((item: any) => item.is_read)).toBe(true);

    const dbState = getMockState();
    expect(dbState.likes).toHaveLength(2);
    expect(dbState.comments).toHaveLength(3);
    expect(dbState.notifications).toHaveLength(4);
  });

  it("returns feed comment summaries and paginates comment threads separately", async () => {
    const { app } = createApp();
    const alice = await registerUser({
      first_name: "Alice",
      last_name: "Adams",
      email: "alice@example.com",
      password: "password123",
    });
    const bob = await registerUser({
      first_name: "Bob",
      last_name: "Baker",
      email: "bob@example.com",
      password: "password456",
    });

    const createdPost = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ content: "Post with many comments", visibility: "public" });
    expect(createdPost.status).toBe(200);
    const postId = createdPost.body.post.id;

    const firstComment = await request(app)
      .post(`/api/posts/${postId}/comment`)
      .set("Authorization", `Bearer ${bob.token}`)
      .send({ content: "First comment" });
    const firstCommentId = firstComment.body.comment.id;

    const reply = await request(app)
      .post(`/api/posts/${postId}/comments/${firstCommentId}/reply`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ content: "Reply to first" });
    expect(reply.status).toBe(200);

    const secondComment = await request(app)
      .post(`/api/posts/${postId}/comment`)
      .set("Authorization", `Bearer ${bob.token}`)
      .send({ content: "Second comment" });
    const secondCommentId = secondComment.body.comment.id;

    const thirdComment = await request(app)
      .post(`/api/posts/${postId}/comment`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ content: "Third comment" });
    const thirdCommentId = thirdComment.body.comment.id;

    const feed = await request(app)
      .get("/api/posts")
      .set("Authorization", `Bearer ${bob.token}`);
    expect(feed.status).toBe(200);
    expect(feed.body.posts).toHaveLength(1);
    expect(feed.body.posts[0].comments).toEqual([]);
    expect(feed.body.posts[0].commentsLoaded).toBe(false);
    expect(feed.body.posts[0].totalComments).toBe(4);

    const firstPage = await request(app)
      .get(`/api/posts/${postId}/comments?limit=2`)
      .set("Authorization", `Bearer ${bob.token}`);
    expect(firstPage.status).toBe(200);
    expect(firstPage.body.totalComments).toBe(4);
    expect(firstPage.body.hasMore).toBe(true);
    expect(firstPage.body.comments).toHaveLength(2);
    expect(firstPage.body.comments.map((comment: any) => comment.id)).toEqual([thirdCommentId, secondCommentId]);
    expect(firstPage.body.nextCursor).toBe(secondCommentId);

    const secondPage = await request(app)
      .get(`/api/posts/${postId}/comments?limit=2&cursor=${firstPage.body.nextCursor}`)
      .set("Authorization", `Bearer ${bob.token}`);
    expect(secondPage.status).toBe(200);
    expect(secondPage.body.hasMore).toBe(false);
    expect(secondPage.body.comments).toHaveLength(1);
    expect(secondPage.body.comments[0].id).toBe(firstCommentId);
    expect(secondPage.body.comments[0].replies).toHaveLength(1);
    expect(secondPage.body.comments[0].replies[0].content).toBe("Reply to first");
  });

  it("forbids reading paginated comments for another user's private post", async () => {
    const { app } = createApp();
    const alice = await registerUser({
      first_name: "Alice",
      last_name: "Adams",
      email: "alice@example.com",
      password: "password123",
    });
    const bob = await registerUser({
      first_name: "Bob",
      last_name: "Baker",
      email: "bob@example.com",
      password: "password456",
    });

    const privatePost = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ content: "Private thread", visibility: "private" });
    expect(privatePost.status).toBe(200);

    const response = await request(app)
      .get(`/api/posts/${privatePost.body.post.id}/comments`)
      .set("Authorization", `Bearer ${bob.token}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Forbidden");
  });
});