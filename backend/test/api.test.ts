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

  function getAuthCookie(response: request.Response) {
    const cookieHeader = response.headers["set-cookie"]?.find((value) => value.startsWith("token="));
    expect(cookieHeader).toBeTruthy();
    return cookieHeader!.split(";")[0];
  }

  function withSession(req: request.Test, session: { cookie: string }) {
    return req.set("Cookie", session.cookie);
  }

  async function registerUser(payload: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
  }) {
    const { app } = createApp();
    const response = await request(app).post("/api/auth/register").send(payload);
    expect(response.status).toBe(200);
    return {
      user: response.body.user as { id: number; email: string },
      cookie: getAuthCookie(response),
    };
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
    expect(getAuthCookie(login)).toContain("token=");

    const me = await withSession(request(app).get("/api/auth/me"), { cookie: getAuthCookie(login) });
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

    const publicPost = await withSession(request(app).post("/api/posts"), alice)
      .send({ content: "Public update", visibility: "public" });
    const privatePost = await withSession(request(app).post("/api/posts"), alice)
      .send({ content: "Private update", visibility: "private" });

    expect(publicPost.status).toBe(200);
    expect(privatePost.status).toBe(200);

    const bobFeed = await withSession(request(app).get("/api/posts"), bob);
    expect(bobFeed.status).toBe(200);
    expect(bobFeed.body.posts).toHaveLength(1);
    expect(bobFeed.body.posts[0].content).toBe("Public update");

    const aliceFeed = await withSession(request(app).get("/api/posts"), alice);
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

    const createdPost = await withSession(request(app).post("/api/posts"), alice)
      .send({ content: "Team update", visibility: "public" });
    expect(createdPost.status).toBe(200);
    const postId = createdPost.body.post.id;

    const bobComment = await withSession(request(app).post(`/api/posts/${postId}/comment`), bob)
      .send({ content: "Nice work" });
    expect(bobComment.status).toBe(200);
    const bobCommentId = bobComment.body.comment.id;

    const aliceCommentLike = await withSession(request(app).post(`/api/posts/${postId}/comments/${bobCommentId}/like`), alice);
    expect(aliceCommentLike.status).toBe(200);
    expect(aliceCommentLike.body.action).toBe("liked");

    const aliceComment = await withSession(request(app).post(`/api/posts/${postId}/comment`), alice)
      .send({ content: "Thanks everyone" });
    expect(aliceComment.status).toBe(200);
    const aliceCommentId = aliceComment.body.comment.id;

    const bobReply = await withSession(request(app).post(`/api/posts/${postId}/comments/${aliceCommentId}/reply`), bob)
      .send({ content: "Following up" });
    expect(bobReply.status).toBe(200);
    const bobReplyId = bobReply.body.reply.id;

    const charlieLike = await withSession(request(app).post(`/api/posts/${postId}/like`), charlie);
    expect(charlieLike.status).toBe(200);
    expect(charlieLike.body.action).toBe("liked");

    const aliceNotifications = await withSession(request(app).get("/api/notifications"), alice);
    expect(aliceNotifications.status).toBe(200);
    expect(aliceNotifications.body.unread).toBe(3);
    expect(aliceNotifications.body.notifications).toHaveLength(3);
    expect(aliceNotifications.body.notifications.map((item: any) => item.type).sort()).toEqual([
      "comment",
      "like_post",
      "reply",
    ]);

    const replyNotification = aliceNotifications.body.notifications.find((item: any) => item.type === "reply");
    const replyDetails = await withSession(request(app).get(`/api/notifications/${replyNotification.id}/details`), alice);
    expect(replyDetails.status).toBe(200);
    expect(replyDetails.body.focusCommentId).toBe(aliceCommentId);
    expect(replyDetails.body.focusReplyId).toBe(bobReplyId);
    expect(replyDetails.body.post.id).toBe(postId);

    const bobNotifications = await withSession(request(app).get("/api/notifications"), bob);
    expect(bobNotifications.status).toBe(200);
    expect(bobNotifications.body.notifications.map((item: any) => item.type)).toEqual(["like_comment"]);

    const likeCommentNotification = bobNotifications.body.notifications[0];
    const likeCommentDetails = await withSession(request(app).get(`/api/notifications/${likeCommentNotification.id}/details`), bob);
    expect(likeCommentDetails.status).toBe(200);
    expect(likeCommentDetails.body.focusCommentId).toBe(bobCommentId);
    expect(likeCommentDetails.body.focusReplyId).toBeNull();

    const markReplyRead = await withSession(request(app).post(`/api/notifications/${replyNotification.id}/read`), alice);
    expect(markReplyRead.status).toBe(200);

    const markAllRead = await withSession(request(app).post("/api/notifications/mark-all-read"), alice);
    expect(markAllRead.status).toBe(200);

    const finalAliceNotifications = await withSession(request(app).get("/api/notifications"), alice);
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

    const createdPost = await withSession(request(app).post("/api/posts"), alice)
      .send({ content: "Post with many comments", visibility: "public" });
    expect(createdPost.status).toBe(200);
    const postId = createdPost.body.post.id;

    const firstComment = await withSession(request(app).post(`/api/posts/${postId}/comment`), bob)
      .send({ content: "First comment" });
    const firstCommentId = firstComment.body.comment.id;

    const reply = await withSession(request(app).post(`/api/posts/${postId}/comments/${firstCommentId}/reply`), alice)
      .send({ content: "Reply to first" });
    expect(reply.status).toBe(200);

    const secondComment = await withSession(request(app).post(`/api/posts/${postId}/comment`), bob)
      .send({ content: "Second comment" });
    const secondCommentId = secondComment.body.comment.id;

    const thirdComment = await withSession(request(app).post(`/api/posts/${postId}/comment`), alice)
      .send({ content: "Third comment" });
    const thirdCommentId = thirdComment.body.comment.id;

    const feed = await withSession(request(app).get("/api/posts"), bob);
    expect(feed.status).toBe(200);
    expect(feed.body.posts).toHaveLength(1);
    expect(feed.body.posts[0].comments).toEqual([]);
    expect(feed.body.posts[0].commentsLoaded).toBe(false);
    expect(feed.body.posts[0].totalComments).toBe(4);

    const firstPage = await withSession(request(app).get(`/api/posts/${postId}/comments?limit=2`), bob);
    expect(firstPage.status).toBe(200);
    expect(firstPage.body.totalComments).toBe(4);
    expect(firstPage.body.hasMore).toBe(true);
    expect(firstPage.body.comments).toHaveLength(2);
    expect(firstPage.body.comments.map((comment: any) => comment.id)).toEqual([thirdCommentId, secondCommentId]);
    expect(firstPage.body.nextCursor).toBe(secondCommentId);

    const secondPage = await withSession(request(app).get(`/api/posts/${postId}/comments?limit=2&cursor=${firstPage.body.nextCursor}`), bob);
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

    const privatePost = await withSession(request(app).post("/api/posts"), alice)
      .send({ content: "Private thread", visibility: "private" });
    expect(privatePost.status).toBe(200);

    const response = await withSession(request(app).get(`/api/posts/${privatePost.body.post.id}/comments`), bob);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Forbidden");
  });
});