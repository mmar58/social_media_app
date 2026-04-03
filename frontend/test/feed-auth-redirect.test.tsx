import React from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import FeedPage from "../app/feed/page";

const replace = vi.fn();

const authState = {
  user: null,
  loading: false,
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock("../app/context/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("../app/context/PostContext", () => ({
  usePosts: () => ({
    feedPosts: [],
    hasMorePosts: false,
    loadingFeed: false,
    loadingMorePosts: false,
    fetchFeed: vi.fn().mockResolvedValue(undefined),
    loadMoreFeed: vi.fn().mockResolvedValue(undefined),
    createPost: vi.fn().mockResolvedValue(undefined),
    likePost: vi.fn().mockResolvedValue(undefined),
    addComment: vi.fn().mockResolvedValue(undefined),
    likeComment: vi.fn().mockResolvedValue(undefined),
    replyToComment: vi.fn().mockResolvedValue(undefined),
    loadPostComments: vi.fn().mockResolvedValue(undefined),
    loadMorePostComments: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../app/components/Header", () => ({ default: () => <div>Header</div> }));
vi.mock("../app/components/CreatePostBox", () => ({ default: () => <div>CreatePostBox</div> }));
vi.mock("../app/components/Loader", () => ({ default: () => <div>Loader</div> }));
vi.mock("../app/components/PostItem", () => ({ default: () => <div>PostItem</div> }));
vi.mock("../app/components/StoriesPlaceholder", () => ({ default: () => <div>Stories</div> }));
vi.mock("../app/components/LeftSidebar", () => ({ default: () => <div>LeftSidebar</div> }));
vi.mock("../app/components/RightSidebar", () => ({ default: () => <div>RightSidebar</div> }));

describe("feed auth redirect", () => {
  it("redirects unauthenticated users to login without staying on the loader", async () => {
    const { container, queryByText } = render(<FeedPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/login");
    });

    expect(queryByText("Loader")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});