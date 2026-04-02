import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PostProvider, usePosts } from "../app/context/PostContext";

const socketHandlers = new Map<string, (payload: any) => void>();

const mockSocket = {
  on: vi.fn((event: string, handler: (payload: any) => void) => {
    socketHandlers.set(event, handler);
  }),
  off: vi.fn((event: string, handler: (payload: any) => void) => {
    if (socketHandlers.get(event) === handler) {
      socketHandlers.delete(event);
    }
  }),
  emit: vi.fn(),
};

const authContext = {
  token: "test-token",
  user: {
    id: 1,
    first_name: "Taylor",
    last_name: "Tester",
    email: "taylor@example.com",
  },
  socket: mockSocket,
};

vi.mock("../app/context/AuthContext", () => ({
  useAuth: () => authContext,
}));

vi.mock("../app/lib/request", () => ({
  requestJson: vi.fn(),
  invalidateRequestCache: vi.fn(),
}));

function TestConsumer() {
  const { feedPosts } = usePosts();

  const post = feedPosts[0];
  const rootComment = post?.comments?.find((comment: { id: number }) => comment.id === 201);

  return (
    <div>
      <div data-testid="post-count">{feedPosts.length}</div>
      <div data-testid="likes">{post?.likes ?? 0}</div>
      <div data-testid="total-comments">{post?.totalComments ?? 0}</div>
      <div data-testid="comment-likes">{rootComment?.likes ?? 0}</div>
      <div data-testid="reply-count">{rootComment?.replies?.length ?? 0}</div>
      <div data-testid="latest-comment">{post?.comments?.[0]?.content ?? ""}</div>
      <div data-testid="latest-reply">{rootComment?.replies?.[0]?.content ?? ""}</div>
    </div>
  );
}

describe("PostContext socket-driven updates", () => {
  beforeEach(() => {
    socketHandlers.clear();
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();
    mockSocket.emit.mockClear();
  });

  it("registers socket listeners and applies incoming post, comment, like, and reply events", async () => {
    const { unmount } = render(
      <PostProvider>
        <TestConsumer />
      </PostProvider>
    );

    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalledWith("receive_post", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith("update_likes", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith("receive_comment", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith("update_comment_likes", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith("receive_reply", expect.any(Function));
    });

    act(() => {
      socketHandlers.get("receive_post")?.({
        id: 101,
        content: "Initial post",
        likes: 0,
        totalComments: 1,
        commentsLoaded: true,
        comments: [
          {
            id: 201,
            content: "Root comment",
            likes: 0,
            replies: [],
          },
        ],
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("post-count")).toHaveTextContent("1");
      expect(screen.getByTestId("latest-comment")).toHaveTextContent("Root comment");
    });

    act(() => {
      socketHandlers.get("update_likes")?.({ postId: 101, action: "liked" });
      socketHandlers.get("receive_comment")?.({
        postId: 101,
        comment: { id: 202, content: "Fresh comment", likes: 0, replies: [] },
      });
      socketHandlers.get("update_comment_likes")?.({ postId: 101, commentId: 201, action: "liked" });
      socketHandlers.get("receive_reply")?.({
        postId: 101,
        commentId: 201,
        reply: { id: 301, content: "Fresh reply" },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("likes")).toHaveTextContent("1");
      expect(screen.getByTestId("total-comments")).toHaveTextContent("3");
      expect(screen.getByTestId("comment-likes")).toHaveTextContent("1");
      expect(screen.getByTestId("reply-count")).toHaveTextContent("1");
      expect(screen.getByTestId("latest-comment")).toHaveTextContent("Fresh comment");
      expect(screen.getByTestId("latest-reply")).toHaveTextContent("Fresh reply");
    });

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith("receive_post", expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith("update_likes", expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith("receive_comment", expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith("update_comment_likes", expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith("receive_reply", expect.any(Function));
  });
});
