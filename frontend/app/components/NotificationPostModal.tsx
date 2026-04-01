"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import PostItem from "./PostItem";
import { apiUrl, socketBaseUrl } from "../lib/api";

interface NotificationPostModalProps {
  isOpen: boolean;
  post: any | null;
  focusCommentId?: number | null;
  focusReplyId?: number | null;
  onClose: () => void;
}

export default function NotificationPostModal({ isOpen, post, focusCommentId, focusReplyId, onClose }: NotificationPostModalProps) {
  const { token } = useAuth();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [modalPost, setModalPost] = useState<any | null>(post);

  useEffect(() => {
    setModalPost(post);
  }, [post]);

  const jumpTarget = useMemo(() => {
    if (!modalPost) return null;
    if (focusReplyId) return { type: "reply", targetId: focusReplyId };
    if (focusCommentId) return { type: "comment", targetId: focusCommentId };
    return { type: "like_post", targetId: modalPost.id };
  }, [focusCommentId, focusReplyId, modalPost]);

  useEffect(() => {
    if (!isOpen) return;

    const targetId = focusReplyId ? `notification-reply-${focusReplyId}` : focusCommentId ? `notification-comment-${focusCommentId}` : null;
    if (!targetId) return;

    const timerId = window.setTimeout(() => {
      const element = scrollRef.current?.querySelector<HTMLElement>(`#${targetId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 200);

    return () => window.clearTimeout(timerId);
  }, [focusCommentId, focusReplyId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !modalPost) {
      return;
    }

    const socket = io(socketBaseUrl, { transports: ["websocket"], withCredentials: true });
    socketRef.current = socket;

    socket.on("update_likes", ({ postId, action }) => {
      setModalPost((current: any) => {
        if (!current || current.id !== Number(postId)) {
          return current;
        }

        const currentLikes = Number(current.likes) || 0;
        return {
          ...current,
          likes: action === "liked" ? currentLikes + 1 : Math.max(0, currentLikes - 1),
        };
      });
    });

    socket.on("receive_comment", ({ postId, comment }) => {
      setModalPost((current: any) => {
        if (!current || current.id !== Number(postId)) {
          return current;
        }

        const alreadyExists = (current.comments || []).some((existingComment: any) => existingComment.id === comment.id);
        if (alreadyExists) {
          return current;
        }

        return {
          ...current,
          comments: [comment, ...(current.comments || [])],
        };
      });
    });

    socket.on("update_comment_likes", ({ postId, commentId, action }) => {
      setModalPost((current: any) => {
        if (!current || current.id !== Number(postId)) {
          return current;
        }

        return {
          ...current,
          comments: (current.comments || []).map((comment: any) => {
            if (comment.id !== Number(commentId)) {
              return comment;
            }

            const currentLikes = Number(comment.likes) || 0;
            return {
              ...comment,
              likes: action === "liked" ? currentLikes + 1 : Math.max(0, currentLikes - 1),
            };
          }),
        };
      });
    });

    socket.on("receive_reply", ({ postId, commentId, reply }) => {
      setModalPost((current: any) => {
        if (!current || current.id !== Number(postId)) {
          return current;
        }

        return {
          ...current,
          comments: (current.comments || []).map((comment: any) => {
            if (comment.id !== Number(commentId)) {
              return comment;
            }

            const alreadyExists = (comment.replies || []).some((existingReply: any) => existingReply.id === reply.id);
            if (alreadyExists) {
              return comment;
            }

            return {
              ...comment,
              replies: [reply, ...(comment.replies || [])],
            };
          }),
        };
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isOpen, modalPost?.id]);

  const handleLike = async (postId: number) => {
    if (!token) return;

    const response = await fetch(apiUrl(`/api/posts/${postId}/like`), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) return;

    setModalPost((current: any) => {
      if (!current) return current;

      let updatedLikers = [...(current.likers || [])];
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
        isLiked: data.action === "liked",
        likes: data.action === "liked" ? current.likes + 1 : Math.max(0, current.likes - 1),
        likers: updatedLikers,
      };
    });

    socketRef.current?.emit("like_post", { postId, action: data.action });
  };

  const handleComment = async (postId: number, content: string) => {
    if (!token) return;

    const response = await fetch(apiUrl(`/api/posts/${postId}/comment`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content }),
    });
    const data = await response.json();
    if (!response.ok) return;

    setModalPost((current: any) => {
      if (!current) return current;
      return { ...current, comments: [data.comment, ...(current.comments || [])] };
    });

    socketRef.current?.emit("new_comment", { postId, comment: data.comment });
  };

  const handleCommentLike = async (postId: number, commentId: number) => {
    if (!token) return;

    const response = await fetch(apiUrl(`/api/posts/${postId}/comments/${commentId}/like`), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) return;

    setModalPost((current: any) => {
      if (!current) return current;
      return {
        ...current,
        comments: (current.comments || []).map((comment: any) => {
          if (comment.id !== commentId) return comment;
          const currentLikes = Number(comment.likes) || 0;
          return {
            ...comment,
            isLiked: data.action === "liked",
            likes: data.action === "liked" ? currentLikes + 1 : Math.max(0, currentLikes - 1),
          };
        }),
      };
    });

    socketRef.current?.emit("like_comment", { postId, commentId, action: data.action });
  };

  const handleCommentReply = async (postId: number, commentId: number, content: string) => {
    if (!token) return;

    const response = await fetch(apiUrl(`/api/posts/${postId}/comments/${commentId}/reply`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content }),
    });
    const data = await response.json();
    if (!response.ok) return;

    setModalPost((current: any) => {
      if (!current) return current;
      return {
        ...current,
        comments: (current.comments || []).map((comment: any) => {
          if (comment.id !== commentId) return comment;
          return { ...comment, replies: [data.reply, ...(comment.replies || [])] };
        }),
      };
    });

    socketRef.current?.emit("reply_comment", { postId, commentId, reply: data.reply });
  };

  if (!isOpen || !modalPost) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(17, 32, 50, 0.55)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(820px, 100%)",
          maxHeight: "90vh",
          overflow: "hidden",
          background: "var(--bg2)",
          borderRadius: "16px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid rgba(17,32,50,0.08)" }}>
          <h3 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "var(--color6)" }}>Notification</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ border: "none", background: "transparent", fontSize: "28px", lineHeight: 1, color: "var(--color7)", cursor: "pointer" }}
          >
            ×
          </button>
        </div>

        <div ref={scrollRef} style={{ overflowY: "auto", padding: "24px" }}>
          <PostItem
            post={modalPost}
            jumpTarget={jumpTarget}
            onLike={handleLike}
            onComment={handleComment}
            onCommentLike={handleCommentLike}
            onCommentReply={handleCommentReply}
            idPrefix="notification"
          />
        </div>
      </div>
    </div>
  );
}
