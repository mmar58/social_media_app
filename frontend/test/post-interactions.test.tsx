import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreatePostBox from "../app/components/CreatePostBox";
import PostItem from "../app/components/PostItem";

const authContext = {
  user: {
    id: 9,
    first_name: "Taylor",
    last_name: "Tester",
    email: "taylor@example.com",
    profile_picture: "https://example.com/avatar.png",
  },
};

vi.mock("../app/context/AuthContext", () => ({
  useAuth: () => authContext,
}));

describe("post interactions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("submits a new post with the selected visibility", async () => {
    const user = userEvent.setup();
    const onPost = vi.fn();
    render(<CreatePostBox onPost={onPost} />);

    const textarea = screen.getByLabelText(/write something/i);
    await user.type(textarea, "Shipping the test suite today");
    await user.selectOptions(screen.getByRole("combobox"), "private");
    await user.click(screen.getAllByRole("button", { name: /post/i })[0]);

    expect(onPost).toHaveBeenCalledWith("Shipping the test suite today", "private", undefined);
    expect(textarea).toHaveValue("");
  });

  it("handles liking, commenting, liking comments, and replying", async () => {
    const user = userEvent.setup();
    const onLike = vi.fn();
    const onComment = vi.fn();
    const onCommentLike = vi.fn();
    const onCommentReply = vi.fn();

    const post = {
      id: 101,
      authorName: "Alice Adams",
      authorProfilePicture: "https://example.com/alice.png",
      created_at: "2026-04-01T10:00:00.000Z",
      visibility: "public",
      content: "Initial post",
      image_url: null,
      likes: 1,
      isLiked: false,
      likers: [{ userId: 2, name: "Bob Baker", profile_picture: "https://example.com/bob.png" }],
      comments: [
        {
          id: 201,
          authorName: "Bob Baker",
          authorProfilePicture: "https://example.com/bob.png",
          content: "Root comment",
          created_at: "2026-04-01T10:05:00.000Z",
          likes: 2,
          isLiked: false,
          replies: [
            {
              id: 301,
              authorName: "Taylor Tester",
              authorProfilePicture: "https://example.com/taylor.png",
              content: "Nested reply",
            },
          ],
        },
      ],
    };

    const { container } = render(
      <PostItem
        post={post}
        jumpTarget={{ type: "reply", targetId: 301 }}
        onLike={onLike}
        onComment={onComment}
        onCommentLike={onCommentLike}
        onCommentReply={onCommentReply}
      />
    );

    expect(await screen.findByText("Root comment")).toBeInTheDocument();
    expect(screen.getByText("Nested reply")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /like/i }));
    expect(onLike).toHaveBeenCalledWith(101);

    await user.type(screen.getByPlaceholderText(/write a comment/i), "Looks good");
    fireEvent.submit(container.querySelector("form._feed_inner_comment_box_form") as HTMLFormElement);
    await waitFor(() => {
      expect(onComment).toHaveBeenCalledWith(101, "Looks good");
    });

    await user.click(screen.getByText("Reply."));
    await user.type(screen.getByPlaceholderText(/write a reply/i), "Adding a reply");
    fireEvent.submit(container.querySelectorAll("form._feed_inner_comment_box_form")[1] as HTMLFormElement);
    await waitFor(() => {
      expect(onCommentReply).toHaveBeenCalledWith(101, 201, "Adding a reply");
    });

    await user.click(screen.getByText("Like."));
    expect(onCommentLike).toHaveBeenCalledWith(101, 201);
  });
});