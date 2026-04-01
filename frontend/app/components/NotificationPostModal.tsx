"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { usePosts } from "../context/PostContext";
import PostItem from "./PostItem";

interface NotificationPostModalProps {
  isOpen: boolean;
  post: any | null;
  focusCommentId?: number | null;
  focusReplyId?: number | null;
  onClose: () => void;
}

export default function NotificationPostModal({ isOpen, post, focusCommentId, focusReplyId, onClose }: NotificationPostModalProps) {
  const { getPostById, upsertPost, likePost, addComment, likeComment, replyToComment, loadPostComments, loadMorePostComments } = usePosts();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const modalPost = getPostById(post?.id) || post;

  useEffect(() => {
    if (post) {
      upsertPost(post);
    }
  }, [post, upsertPost]);

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
            onLike={likePost}
            onComment={addComment}
            onCommentLike={likeComment}
            onCommentReply={replyToComment}
            onLoadComments={loadPostComments}
            onLoadMoreComments={loadMorePostComments}
            idPrefix="notification"
          />
        </div>
      </div>
    </div>
  );
}
