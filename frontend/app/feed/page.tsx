"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import Header from "../components/Header";
import CreatePostBox from "../components/CreatePostBox";
import Loader from "../components/Loader";
import PostItem from "../components/PostItem";
import StoriesPlaceholder from "../components/StoriesPlaceholder";
import LeftSidebar from "../components/LeftSidebar";
import RightSidebar from "../components/RightSidebar";
import { useRouter, useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";

export default function FeedPage() {
  const socketRef = useRef<Socket | null>(null);
  const { user, loading, token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<any[]>([]);
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
    } else if (user && token) {
      fetchPosts();
      const socket = io("http://localhost:5000", { transports: ["websocket"], withCredentials: true });
      socketRef.current = socket;

      socket.on("receive_post", (newPost) => {
        setPosts((prev) => [newPost, ...prev]);
      });
      socket.on("update_likes", ({ postId, action }) => {
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id === Number(postId)) {
              return { ...p, likes: action === "liked" ? p.likes + 1 : p.likes - 1 };
            }
            return p;
          })
        );
      });
      socket.on("receive_comment", ({ postId, comment }) => {
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id === Number(postId)) {
              const alreadyExists = (p.comments || []).some((c: any) => c.id === comment.id);
              if (alreadyExists) return p;
              return { ...p, comments: [comment, ...(p.comments || [])] };
            }
            return p;
          })
        );
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [user, loading, router, token]);

  const fetchPosts = useCallback(
    async (search?: string) => {
      try {
        const params = new URLSearchParams();
        if (search?.trim()) params.set("search", search);
        params.set("limit", "50");
        const res = await fetch(`http://localhost:5000/api/posts?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) setPosts(
          data.posts.map((p: any) => ({
            ...p,
            comments: (p.comments || []).slice().sort((a: any, b: any) => {
              const ta = a.created_at ? new Date(a.created_at).getTime() : a.id || 0;
              const tb = b.created_at ? new Date(b.created_at).getTime() : b.id || 0;
              return tb - ta;
            }),
          }))
        );
      } catch (err) {
        console.error(err);
      }
    },
    [token]
  );

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // Debounce search
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchPosts(query);
    }, 400);
  };

  const handlePost = async (content: string, visibility: string, image?: File) => {
    try {
      const formData = new FormData();
      formData.append("content", content);
      formData.append("visibility", visibility);
      if (image) formData.append("image", image);

      const res = await fetch("http://localhost:5000/api/posts", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const { post } = await res.json();
        setPosts([post, ...posts]);
        if (post.visibility === "public") {
          socketRef.current?.emit("new_post", post);
        }
      }
    } catch (err) {}
  };

  const handleLike = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:5000/api/posts/${id}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setPosts(
          posts.map((p) => {
            if (p.id === id) {
              let updatedLikers = [...(p.likers || [])];
              if (data.action === "liked") {
                const newLiker = {
                  userId: data.likerUserId,
                  profile_picture: data.likerProfilePicture,
                  name: data.likerName,
                };
                updatedLikers = [newLiker, ...updatedLikers.filter((l: any) => l.userId !== data.likerUserId)].slice(0, 8);
              } else {
                updatedLikers = updatedLikers.filter((l: any) => l.userId !== data.likerUserId);
              }
              return {
                ...p,
                isLiked: data.action === "liked",
                likes: data.action === "liked" ? p.likes + 1 : p.likes - 1,
                likers: updatedLikers,
              };
            }
            return p;
          })
        );
        socketRef.current?.emit("like_post", { postId: id, action: data.action });
      }
    } catch (err) {}
  };

  const handleComment = async (postId: number, content: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/posts/${postId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const { comment } = await res.json();
        setPosts(
          posts.map((p) => {
            if (p.id === postId) {
              return { ...p, comments: [comment, ...(p.comments || [])] };
            }
            return p;
          })
        );
        socketRef.current?.emit("new_comment", { postId, comment });
      }
    } catch (err) {}
  };

  const handleCommentLike = async (postId: number, commentId: number) => {
    try {
      const res = await fetch(`http://localhost:5000/api/posts/${postId}/comments/${commentId}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id === postId) {
              return {
                ...p,
                comments: p.comments.map((c: any) => {
                  if (c.id === commentId) {
                    return {
                      ...c,
                      isLiked: data.action === "liked",
                      likes: data.action === "liked" ? c.likes + 1 : c.likes - 1,
                    };
                  }
                  return c;
                }),
              };
            }
            return p;
          })
        );
      }
    } catch (err) {}
  };

  const handleCommentReply = async (postId: number, commentId: number, content: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/posts/${postId}/comments/${commentId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const { reply } = await res.json();
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id === postId) {
              return {
                ...p,
                comments: p.comments.map((c: any) => {
                    if (c.id === commentId) {
                    return { ...c, replies: [reply, ...(c.replies || [])] };
                  }
                  return c;
                }),
              };
            }
            return p;
          })
        );
      }
    } catch (err) {}
  };

  useEffect(() => {
    if (!jumpTarget || !posts.length || jumpHandled === jumpParam) return;

    const getTargetElementId = () => {
      if (jumpTarget.type === "like_post") {
        return `post-${jumpTarget.targetId}`;
      }

      for (const post of posts) {
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
  }, [jumpHandled, jumpParam, jumpTarget, posts]);

  if (loading || !user) {
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
                {/* Left Sidebar - Sticky */}
                <div className="col-xl-3 col-lg-3 col-md-12 col-sm-12">
                  <div className="_sidebar_sticky">
                    <LeftSidebar />
                  </div>
                </div>

                {/* Middle Column - Scrollable */}
                <div className="col-xl-6 col-lg-6 col-md-12 col-sm-12">
                  <div className="_layout_middle_wrap">
                    <div className="_layout_middle_inner">
                      {/* Stories */}
                      <StoriesPlaceholder />

                      {/* Create Post */}
                      <CreatePostBox onPost={handlePost} />

                      {/* Posts */}
                      <div className="posts-container">
                        {posts.map((post) => (
                          <PostItem
                            key={post.id}
                            post={post}
                            jumpTarget={jumpTarget}
                            onLike={handleLike}
                            onComment={handleComment}
                            onCommentLike={handleCommentLike}
                            onCommentReply={handleCommentReply}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Sidebar - Sticky */}
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
