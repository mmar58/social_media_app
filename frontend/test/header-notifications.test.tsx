import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Header from "../app/components/Header";

const authContext = {
  user: {
    id: 1,
    first_name: "Taylor",
    last_name: "Tester",
    email: "taylor@example.com",
    profile_picture: "https://example.com/profile.png",
  },
  token: "token-1",
  logout: vi.fn(),
  notifications: [
    {
      id: 77,
      type: "reply",
      senderName: "Alice Adams",
      senderProfile: "https://example.com/alice.png",
      created_at: "2026-04-01T10:00:00.000Z",
      is_read: false,
    },
  ],
  unread: 1,
  markAllRead: vi.fn().mockResolvedValue(undefined),
  markRead: vi.fn().mockResolvedValue(undefined),
};

const postsContext = {
  upsertPost: vi.fn(),
  getPostById: vi.fn().mockReturnValue(null),
  likePost: vi.fn(),
  addComment: vi.fn(),
  likeComment: vi.fn(),
  replyToComment: vi.fn(),
  loadPostComments: vi.fn().mockResolvedValue(undefined),
  loadMorePostComments: vi.fn().mockResolvedValue(undefined),
};

const requestJson = vi.fn();

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => React.createElement("a", { href, ...props }, children),
}));

vi.mock("../app/context/AuthContext", () => ({
  useAuth: () => authContext,
}));

vi.mock("../app/context/PostContext", () => ({
  usePosts: () => postsContext,
}));

vi.mock("../app/lib/request", () => ({
  requestJson: (...args: any[]) => requestJson(...args),
}));

describe("header notifications", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    authContext.logout.mockReset();
    authContext.markAllRead.mockReset().mockResolvedValue(undefined);
    authContext.markRead.mockReset().mockResolvedValue(undefined);
    postsContext.upsertPost.mockReset();
    postsContext.getPostById.mockReset().mockReturnValue(null);
    postsContext.likePost.mockReset();
    postsContext.addComment.mockReset();
    postsContext.likeComment.mockReset();
    postsContext.replyToComment.mockReset();
    postsContext.loadPostComments.mockReset().mockResolvedValue(undefined);
    postsContext.loadMorePostComments.mockReset().mockResolvedValue(undefined);
    requestJson.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("renders notifications and opens the focused modal through the shared post store", async () => {
    const user = userEvent.setup();
    requestJson.mockResolvedValue({
      post: {
        id: 55,
        authorName: "Alice Adams",
        authorProfilePicture: "https://example.com/alice.png",
        created_at: "2026-04-01T10:00:00.000Z",
        visibility: "public",
        content: "Focused post content",
        likes: 0,
        isLiked: false,
        likers: [],
        commentsLoaded: true,
        hasMoreComments: false,
        totalComments: 0,
        comments: [],
      },
      focusCommentId: 201,
      focusReplyId: null,
    });

    const { container } = render(<Header />);
    await user.click(container.querySelector("button._header_notify_btn") as HTMLButtonElement);

    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText(/alice adams/i)).toBeInTheDocument();

    await user.click(screen.getByText(/alice adams/i));

    await waitFor(() => {
      expect(authContext.markRead).toHaveBeenCalledWith(77);
      expect(requestJson).toHaveBeenCalled();
      expect(postsContext.upsertPost).toHaveBeenCalledWith(expect.objectContaining({ id: 55, content: "Focused post content" }));
    });

    expect(await screen.findByText("Notification")).toBeInTheDocument();
    expect(screen.getByText("Focused post content")).toBeInTheDocument();
  });
});