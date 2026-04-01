"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { usePosts } from "../context/PostContext";
import Header from "../components/Header";
import CreatePostBox from "../components/CreatePostBox";
import Loader from "../components/Loader";
import PostItem from "../components/PostItem";
import StoriesPlaceholder from "../components/StoriesPlaceholder";
import LeftSidebar from "../components/LeftSidebar";
import RightSidebar from "../components/RightSidebar";
import { useRouter, useSearchParams } from "next/navigation";

export default function FeedPage() {
  const { user, loading, token } = useAuth();
  const { feedPosts, hasMorePosts, loadingFeed, loadingMorePosts, fetchFeed, loadMoreFeed, createPost, likePost, addComment, likeComment, replyToComment, loadPostComments, loadMorePostComments } = usePosts();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [jumpHandled, setJumpHandled] = useState<string | null>(null);

  const jumpParam = searchParams.get("jump");

  const parseJumpTarget = useCallback((jumpValue: string | null) => {
    if (!jumpValue) return null;

    const [type, rawId] = jumpValue.split(":");
    const targetId = Number(rawId);
    if (!type || Number.isNaN(targetId)) return null;

    return { type, targetId };
  }, []);

  const jumpTarget = parseJumpTarget(jumpParam);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!user || !token) return;
    fetchFeed({ search: searchQuery, reset: true }).catch((error) => console.error(error));
  }, [fetchFeed, searchQuery, token, user]);

  const handleSearch = (query: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearchQuery(query);
      setJumpHandled(null);
    }, 400);
  };

  const handleLoadMore = async () => {
    await loadMoreFeed(searchQuery);
  };

  useEffect(() => {
    if (!jumpTarget || !feedPosts.length || jumpHandled === jumpParam) return;

    const getTargetElementId = () => {
      if (jumpTarget.type === "like_post") {
        return `post-${jumpTarget.targetId}`;
      }

      for (const post of feedPosts) {
        const topLevelComment = (post.comments || []).find((comment: any) => comment.id === jumpTarget.targetId);
        if (topLevelComment) {
          return `comment-${jumpTarget.targetId}`;
        }

        const matchedReply = (post.comments || []).some((comment: any) =>
          (comment.replies || []).some((reply: any) => reply.id === jumpTarget.targetId)
        );
        if (matchedReply) {
          return `reply-${jumpTarget.targetId}`;
        }
      }

      if (jumpTarget.type === "comment") {
        return `post-${jumpTarget.targetId}`;
      }

      return null;
    };

    const elementId = getTargetElementId();
    if (!elementId) return;

    const timeoutId = window.setTimeout(() => {
      const element = document.getElementById(elementId);
      if (!element) return;

      element.scrollIntoView({ behavior: "smooth", block: "center" });
      setJumpHandled(jumpParam);

      const nextUrl = window.location.pathname;
      window.history.replaceState({}, "", nextUrl);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [feedPosts, jumpHandled, jumpParam, jumpTarget]);

  if (loading || !user || loadingFeed) {
    return <Loader />;
  }

  return (
    <>
      <Header searchQuery={searchQuery} onSearch={handleSearch} />
      <div className="_layout _layout_main_wrapper" style={{ minHeight: "100vh" }}>
        <div className="_main_layout">
          <div className="container _custom_container">
            <div className="_layout_inner_wrap">
              <div className="row">
                <div className="col-xl-3 col-lg-3 col-md-12 col-sm-12">
                  <div className="_sidebar_sticky">
                    <LeftSidebar />
                  </div>
                </div>

                <div className="col-xl-6 col-lg-6 col-md-12 col-sm-12">
                  <div className="_layout_middle_wrap">
                    <div className="_layout_middle_inner">
                      <StoriesPlaceholder />

                      <CreatePostBox onPost={createPost} />

                      <div className="posts-container">
                        {feedPosts.map((post) => (
                          <PostItem
                            key={post.id}
                            post={post}
                            jumpTarget={jumpTarget}
                            onLike={likePost}
                            onComment={addComment}
                            onCommentLike={likeComment}
                            onCommentReply={replyToComment}
                            onLoadComments={loadPostComments}
                            onLoadMoreComments={loadMorePostComments}
                          />
                        ))}
                      </div>
                      {hasMorePosts && (
                        <div style={{ display: "flex", justifyContent: "center", marginTop: "16px" }}>
                          <button
                            type="button"
                            className="_feed_inner_text_area_btn_link"
                            onClick={handleLoadMore}
                            disabled={loadingMorePosts}
                            style={{ minWidth: "180px", opacity: loadingMorePosts ? 0.7 : 1 }}
                          >
                            {loadingMorePosts ? "Loading..." : "Load more posts"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="col-xl-3 col-lg-3 col-md-12 col-sm-12">
                  <div className="_sidebar_sticky">
                    <RightSidebar />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
