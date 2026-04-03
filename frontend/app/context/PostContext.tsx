"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { apiUrl } from "../lib/api";
import { invalidateRequestCache, requestJson } from "../lib/request";

type PostRecord = Record<string, any>;

interface FetchFeedOptions {
  search?: string;
  reset?: boolean;
}

interface PostContextType {
  feedPosts: PostRecord[];
  hasMorePosts: boolean;
  loadingFeed: boolean;
  loadingMorePosts: boolean;
  fetchFeed: (options?: FetchFeedOptions) => Promise<void>;
  loadMoreFeed: (search?: string) => Promise<void>;
  createPost: (content: string, visibility: string, image?: File) => Promise<void>;
  likePost: (postId: number) => Promise<void>;
  addComment: (postId: number, content: string) => Promise<void>;
  likeComment: (postId: number, commentId: number) => Promise<void>;
  replyToComment: (postId: number, commentId: number, content: string) => Promise<void>;
  loadPostComments: (postId: number, options?: { reset?: boolean }) => Promise<void>;
  loadMorePostComments: (postId: number) => Promise<void>;
  getPostById: (postId: number | null | undefined) => PostRecord | null;
  upsertPost: (post: PostRecord) => void;
}

const PostContext = createContext<PostContextType | undefined>(undefined);

function normalizePost(post: PostRecord, existing?: PostRecord) {
  const incomingCommentsLoaded = post.commentsLoaded ?? Array.isArray(post.comments);

  return {
    ...existing,
    ...post,
    totalComments: post.totalComments ?? existing?.totalComments ?? post.comments?.length ?? 0,
    commentsLoaded: incomingCommentsLoaded ?? existing?.commentsLoaded ?? false,
    commentsNextCursor: incomingCommentsLoaded
      ? (post.commentsNextCursor ?? null)
      : (existing?.commentsNextCursor ?? post.commentsNextCursor ?? null),
    hasMoreComments: incomingCommentsLoaded
      ? Boolean(post.hasMoreComments)
      : (existing?.hasMoreComments ?? Boolean(post.hasMoreComments)),
    commentsLoading: existing?.commentsLoading ?? false,
    comments: incomingCommentsLoaded
      ? (post.comments || [])
      : (existing?.comments || post.comments || []),
  };
}

function mergeUniqueComments(existingComments: any[], nextComments: any[]) {
  const merged = [...existingComments];
  const seenIds = new Set(existingComments.map((comment) => comment.id));

  for (const comment of nextComments) {
    if (!seenIds.has(comment.id)) {
      merged.push(comment);
      seenIds.add(comment.id);
    }
  }

  return merged;
}

export function PostProvider({ children }: { children: React.ReactNode }) {
  const { user, socket } = useAuth();
  const [postsById, setPostsById] = useState<Record<number, PostRecord>>({});
  const [feedPostIds, setFeedPostIds] = useState<number[]>([]);
  const [feedNextCursor, setFeedNextCursor] = useState<number | null>(null);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);

  useEffect(() => {
    if (!user) {
      setPostsById({});
      setFeedPostIds([]);
      setFeedNextCursor(null);
      setHasMorePosts(false);
    }
  }, [user]);

  const upsertPosts = useCallback((posts: PostRecord[]) => {
    setPostsById((current) => {
      const next = { ...current };
      for (const post of posts) {
        next[post.id] = normalizePost(post, current[post.id]);
      }
      return next;
    });
  }, []);

  const upsertPost = useCallback((post: PostRecord) => {
    upsertPosts([post]);
  }, [upsertPosts]);

  const getPostById = useCallback((postId: number | null | undefined) => {
    if (!postId) return null;
    return postsById[postId] || null;
  }, [postsById]);

  const fetchFeed = useCallback(async (options: FetchFeedOptions = {}) => {
    if (!user) return;

    const { search = "", reset = false } = options;
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    params.set("limit", "20");

    if (reset) {
      setLoadingFeed(true);
    }

    try {
      const data = await requestJson<{ posts: PostRecord[]; nextCursor: number | null; hasMore: boolean }>(
        apiUrl(`/api/posts?${params.toString()}`),
        undefined,
        {
          dedupeKey: `feed:${user.id}:${search.trim()}`,
          cacheTtlMs: 5000,
        }
      );

      upsertPosts(data.posts);
      setFeedPostIds(data.posts.map((post) => post.id));
      setFeedNextCursor(data.nextCursor ?? null);
      setHasMorePosts(Boolean(data.hasMore));
    } finally {
      if (reset) {
        setLoadingFeed(false);
      }
    }
  }, [upsertPosts, user]);

  const loadMoreFeed = useCallback(async (search = "") => {
    if (!user || !feedNextCursor || !hasMorePosts) return;

    setLoadingMorePosts(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      params.set("limit", "20");
      params.set("cursor", String(feedNextCursor));

      const data = await requestJson<{ posts: PostRecord[]; nextCursor: number | null; hasMore: boolean }>(
        apiUrl(`/api/posts?${params.toString()}`),
        undefined,
        {
          dedupeKey: `feed:${user.id}:${search.trim()}:cursor:${feedNextCursor}`,
          cacheTtlMs: 5000,
        }
      );

      upsertPosts(data.posts);
      setFeedPostIds((current) => [...current, ...data.posts.map((post) => post.id).filter((postId) => !current.includes(postId))]);
      setFeedNextCursor(data.nextCursor ?? null);
      setHasMorePosts(Boolean(data.hasMore));
    } finally {
      setLoadingMorePosts(false);
    }
  }, [feedNextCursor, hasMorePosts, upsertPosts, user]);

  const createPost = useCallback(async (content: string, visibility: string, image?: File) => {
    if (!user) return;

    const formData = new FormData();
    formData.append("content", content);
    formData.append("visibility", visibility);
    if (image) formData.append("image", image);

    const data = await requestJson<{ post: PostRecord }>(apiUrl("/api/posts"), {
      method: "POST",
      body: formData,
    });

    invalidateRequestCache((key) => key.includes("/api/posts?"));
    upsertPost(data.post);
    setFeedPostIds((current) => [data.post.id, ...current.filter((postId) => postId !== data.post.id)]);

    if (data.post.visibility === "public") {
      socket?.emit("new_post", data.post);
    }
  }, [socket, upsertPost, user]);

  const likePost = useCallback(async (postId: number) => {
    if (!user) return;

    const data = await requestJson<any>(apiUrl(`/api/posts/${postId}/like`), {
      method: "POST",
    });

    setPostsById((current) => {
      const post = current[postId];
      if (!post) return current;

      let updatedLikers = [...(post.likers || [])];
      if (data.action === "liked") {
        const newLiker = {
          userId: data.likerUserId,
          profile_picture: data.likerProfilePicture,
          name: data.likerName,
        };
        updatedLikers = [newLiker, ...updatedLikers.filter((liker: any) => liker.userId !== data.likerUserId)].slice(0, 8);
      } else {
        updatedLikers = updatedLikers.filter((liker: any) => liker.userId !== data.likerUserId);
      }

      return {
        ...current,
        [postId]: {
          ...post,
          isLiked: data.action === "liked",
          likes: data.action === "liked" ? post.likes + 1 : Math.max(0, post.likes - 1),
          likers: updatedLikers,
        },
      };
    });

    socket?.emit("like_post", { postId, action: data.action });
  }, [socket, user]);

  const addComment = useCallback(async (postId: number, content: string) => {
    if (!user) return;

    const data = await requestJson<{ comment: any }>(apiUrl(`/api/posts/${postId}/comment`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });

    setPostsById((current) => {
      const post = current[postId];
      if (!post) return current;

      const currentComments = post.comments || [];
      const nextComments = [data.comment, ...currentComments.filter((comment: any) => comment.id !== data.comment.id)];
      const nextTotal = (post.totalComments || 0) + 1;
      const nextCursor = post.commentsNextCursor ?? data.comment.id;

      return {
        ...current,
        [postId]: {
          ...post,
          commentsLoaded: true,
          comments: nextComments,
          totalComments: nextTotal,
          hasMoreComments: nextTotal > nextComments.length,
          commentsNextCursor: nextCursor,
        },
      };
    });

    socket?.emit("new_comment", { postId, comment: data.comment });
  }, [socket, user]);

  const likeComment = useCallback(async (postId: number, commentId: number) => {
    if (!user) return;

    const data = await requestJson<any>(apiUrl(`/api/posts/${postId}/comments/${commentId}/like`), {
      method: "POST",
    });

    setPostsById((current) => {
      const post = current[postId];
      if (!post) return current;

      return {
        ...current,
        [postId]: {
          ...post,
          comments: (post.comments || []).map((comment: any) => {
            if (comment.id !== commentId) return comment;
            const currentLikes = Number(comment.likes) || 0;
            return {
              ...comment,
              isLiked: data.action === "liked",
              likes: data.action === "liked" ? currentLikes + 1 : Math.max(0, currentLikes - 1),
            };
          }),
        },
      };
    });

    socket?.emit("like_comment", { postId, commentId, action: data.action });
  }, [socket, user]);

  const replyToComment = useCallback(async (postId: number, commentId: number, content: string) => {
    if (!user) return;

    const data = await requestJson<{ reply: any }>(apiUrl(`/api/posts/${postId}/comments/${commentId}/reply`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });

    setPostsById((current) => {
      const post = current[postId];
      if (!post) return current;

      return {
        ...current,
        [postId]: {
          ...post,
          totalComments: (post.totalComments || 0) + 1,
          comments: (post.comments || []).map((comment: any) => {
            if (comment.id !== commentId) return comment;
            return {
              ...comment,
              replies: [data.reply, ...(comment.replies || [])],
            };
          }),
        },
      };
    });

    socket?.emit("reply_comment", { postId, commentId, reply: data.reply });
  }, [socket, user]);

  const loadPostComments = useCallback(async (postId: number, options: { reset?: boolean } = {}) => {
    if (!user) return;

    setPostsById((current) => ({
      ...current,
      [postId]: {
        ...(current[postId] || {}),
        commentsLoading: true,
      },
    }));

    try {
      const params = new URLSearchParams();
      params.set("limit", "10");

      const data = await requestJson<{ comments: any[]; nextCursor: number | null; hasMore: boolean; totalComments: number }>(
        apiUrl(`/api/posts/${postId}/comments?${params.toString()}`),
        undefined,
        {
          dedupeKey: `post-comments:${user.id}:${postId}:first-page`,
          cacheTtlMs: 5000,
        }
      );

      setPostsById((current) => {
        const post = current[postId] || { id: postId };
        return {
          ...current,
          [postId]: {
            ...post,
            commentsLoading: false,
            commentsLoaded: true,
            comments: options.reset ? data.comments : mergeUniqueComments(post.comments || [], data.comments),
            commentsNextCursor: data.nextCursor,
            hasMoreComments: Boolean(data.hasMore),
            totalComments: data.totalComments,
          },
        };
      });
    } catch (error) {
      setPostsById((current) => ({
        ...current,
        [postId]: {
          ...(current[postId] || {}),
          commentsLoading: false,
        },
      }));
      throw error;
    }
  }, [user]);

  const loadMorePostComments = useCallback(async (postId: number) => {
    if (!user) return;

    const post = postsById[postId];
    if (!post?.commentsNextCursor || !post?.hasMoreComments || post?.commentsLoading) {
      return;
    }

    setPostsById((current) => ({
      ...current,
      [postId]: {
        ...current[postId],
        commentsLoading: true,
      },
    }));

    try {
      const params = new URLSearchParams();
      params.set("limit", "10");
      params.set("cursor", String(post.commentsNextCursor));

      const data = await requestJson<{ comments: any[]; nextCursor: number | null; hasMore: boolean; totalComments: number }>(
        apiUrl(`/api/posts/${postId}/comments?${params.toString()}`),
        undefined,
        {
          dedupeKey: `post-comments:${user.id}:${postId}:cursor:${post.commentsNextCursor}`,
          cacheTtlMs: 5000,
        }
      );

      setPostsById((current) => {
        const currentPost = current[postId] || { id: postId };
        return {
          ...current,
          [postId]: {
            ...currentPost,
            commentsLoading: false,
            commentsLoaded: true,
            comments: mergeUniqueComments(currentPost.comments || [], data.comments),
            commentsNextCursor: data.nextCursor,
            hasMoreComments: Boolean(data.hasMore),
            totalComments: data.totalComments,
          },
        };
      });
    } catch (error) {
      setPostsById((current) => ({
        ...current,
        [postId]: {
          ...current[postId],
          commentsLoading: false,
        },
      }));
      throw error;
    }
  }, [postsById, user]);

  useEffect(() => {
    if (!socket) return;

    const handleReceivePost = (post: PostRecord) => {
      upsertPost(post);
      setFeedPostIds((current) => [post.id, ...current.filter((postId) => postId !== post.id)]);
    };

    const handleUpdateLikes = ({ postId, action }: { postId: number; action: "liked" | "unliked" }) => {
      setPostsById((current) => {
        const post = current[Number(postId)];
        if (!post) return current;

        return {
          ...current,
          [Number(postId)]: {
            ...post,
            likes: action === "liked" ? post.likes + 1 : Math.max(0, post.likes - 1),
          },
        };
      });
    };

    const handleReceiveComment = ({ postId, comment }: { postId: number; comment: any }) => {
      setPostsById((current) => {
        const post = current[Number(postId)];
        if (!post) return current;

        const nextTotal = (post.totalComments || 0) + 1;
        if (!post.commentsLoaded) {
          return {
            ...current,
            [Number(postId)]: {
              ...post,
              totalComments: nextTotal,
              hasMoreComments: true,
            },
          };
        }

        const alreadyExists = (post.comments || []).some((existingComment: any) => existingComment.id === comment.id);
        if (alreadyExists) return current;

        return {
          ...current,
          [Number(postId)]: {
            ...post,
            totalComments: nextTotal,
            hasMoreComments: nextTotal > (post.comments || []).length + 1,
            comments: [comment, ...(post.comments || [])],
          },
        };
      });
    };

    const handleUpdateCommentLikes = ({ postId, commentId, action }: { postId: number; commentId: number; action: "liked" | "unliked" }) => {
      setPostsById((current) => {
        const post = current[Number(postId)];
        if (!post) return current;

        return {
          ...current,
          [Number(postId)]: {
            ...post,
            comments: (post.comments || []).map((comment: any) => {
              if (comment.id !== Number(commentId)) return comment;
              const currentLikes = Number(comment.likes) || 0;
              return {
                ...comment,
                likes: action === "liked" ? currentLikes + 1 : Math.max(0, currentLikes - 1),
              };
            }),
          },
        };
      });
    };

    const handleReceiveReply = ({ postId, commentId, reply }: { postId: number; commentId: number; reply: any }) => {
      setPostsById((current) => {
        const post = current[Number(postId)];
        if (!post) return current;

        const nextTotal = (post.totalComments || 0) + 1;
        return {
          ...current,
          [Number(postId)]: {
            ...post,
            totalComments: nextTotal,
            comments: (post.comments || []).map((comment: any) => {
              if (comment.id !== Number(commentId)) return comment;
              const alreadyExists = (comment.replies || []).some((existingReply: any) => existingReply.id === reply.id);
              if (alreadyExists) return comment;
              return {
                ...comment,
                replies: [reply, ...(comment.replies || [])],
              };
            }),
          },
        };
      });
    };

    socket.on("receive_post", handleReceivePost);
    socket.on("update_likes", handleUpdateLikes);
    socket.on("receive_comment", handleReceiveComment);
    socket.on("update_comment_likes", handleUpdateCommentLikes);
    socket.on("receive_reply", handleReceiveReply);

    return () => {
      socket.off("receive_post", handleReceivePost);
      socket.off("update_likes", handleUpdateLikes);
      socket.off("receive_comment", handleReceiveComment);
      socket.off("update_comment_likes", handleUpdateCommentLikes);
      socket.off("receive_reply", handleReceiveReply);
    };
  }, [socket, upsertPost]);

  const value = useMemo<PostContextType>(() => ({
    feedPosts: feedPostIds.map((postId) => postsById[postId]).filter(Boolean),
    hasMorePosts,
    loadingFeed,
    loadingMorePosts,
    fetchFeed,
    loadMoreFeed,
    createPost,
    likePost,
    addComment,
    likeComment,
    replyToComment,
    loadPostComments,
    loadMorePostComments,
    getPostById,
    upsertPost,
  }), [
    addComment,
    createPost,
    feedPostIds,
    fetchFeed,
    getPostById,
    hasMorePosts,
    likeComment,
    likePost,
    loadMoreFeed,
    loadMorePostComments,
    loadingFeed,
    loadingMorePosts,
    postsById,
    replyToComment,
    loadPostComments,
    upsertPost,
  ]);

  return <PostContext.Provider value={value}>{children}</PostContext.Provider>;
}

export function usePosts() {
  const context = useContext(PostContext);
  if (!context) {
    throw new Error("usePosts must be used within a PostProvider");
  }
  return context;
}