"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import PostItem from "./PostItem";
import { apiUrl } from "../lib/api";

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
        likes: data.action === "liked" ? current.likes + 1 : current.likes - 1,
        likers: updatedLikers,
      };
    });
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
          return {
            ...comment,
            isLiked: data.action === "liked",
            likes: data.action === "liked" ? comment.likes + 1 : comment.likes - 1,
          };
        }),
      };
    });
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
