"use client";

import React, { useEffect } from "react";

interface NotificationPostModalProps {
  isOpen: boolean;
  post: any | null;
  focusCommentId?: number | null;
  focusReplyId?: number | null;
  onClose: () => void;
}

export default function NotificationPostModal({ isOpen, post, focusCommentId, focusReplyId, onClose }: NotificationPostModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const targetId = focusReplyId ? `notification-reply-${focusReplyId}` : focusCommentId ? `notification-comment-${focusCommentId}` : null;
    if (!targetId) return;

    const timerId = window.setTimeout(() => {
      const element = document.getElementById(targetId);
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

  if (!isOpen || !post) return null;

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
          <h3 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "var(--color6)" }}></h3>
          <button
            type="button"
            onClick={onClose}
            style={{ border: "none", background: "transparent", fontSize: "28px", lineHeight: 1, color: "var(--color7)", cursor: "pointer" }}
          >
            ×
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: "24px" }}>
          <div className="_feed_inner_timeline_post_area _b_radious6" style={{ marginBottom: 0 }}>
            <div className="_feed_inner_timeline_content _padd_r24 _padd_l24" style={{ paddingTop: 0 }}>
              <div className="_feed_inner_timeline_post_top">
                <div className="_feed_inner_timeline_post_box">
                  <div className="_feed_inner_timeline_post_box_image">
                    <img
                      src={post.authorProfilePicture || "/assets/images/post_img.png"}
                      alt=""
                      className="_post_img"
                      style={{ borderRadius: "50%", objectFit: "cover", width: "44px", height: "44px" }}
                    />
                  </div>
                  <div className="_feed_inner_timeline_post_box_txt">
                    <h4 className="_feed_inner_timeline_post_box_title">{post.authorName}</h4>
                    <p className="_feed_inner_timeline_post_box_para">
                      {post.created_at ? new Date(post.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now"}
                    </p>
                  </div>
                </div>
              </div>

              <h4 className="_feed_inner_timeline_post_title">{post.content}</h4>

              {post.image_url && (
                <div className="_feed_inner_timeline_image">
                  <img
                    src={`http://localhost:5000${post.image_url}`}
                    alt="Post"
                    className="_time_img"
                    style={{ width: "100%", borderRadius: "6px", marginTop: "12px", objectFit: "cover", maxHeight: "500px" }}
                  />
                </div>
              )}
            </div>

            <div className="_feed_inner_timeline_total_reacts _padd_r24 _padd_l24" style={{ marginBottom: 12 }}>
              <div className="_feed_inner_timeline_total_reacts_image">
                {post.likes > 0 && <p className="_feed_inner_timeline_total_reacts_para">{post.likes}</p>}
              </div>
              <div className="_feed_inner_timeline_total_reacts_txt">
                <p className="_feed_inner_timeline_total_reacts_para1"><span>{post.comments?.length || 0}</span> Comment</p>
              </div>
            </div>

            <div className="_timline_comment_main" style={{ padding: "0 24px 24px" }}>
              {post.comments?.map((comment: any) => {
                const isFocusedComment = focusCommentId === comment.id;
                return (
                  <div
                    id={`notification-comment-${comment.id}`}
                    className="_comment_main"
                    key={comment.id}
                    style={{ scrollMarginTop: "120px" }}
                  >
                    <div className="_comment_image">
                      <img
                        src={comment.authorProfilePicture || "/assets/images/txt_img.png"}
                        alt=""
                        className="_comment_img1"
                        style={{ borderRadius: "50%", objectFit: "cover" }}
                      />
                    </div>
                    <div className="_comment_area" style={{ flex: 1, width: "100%" }}>
                      <div
                        className="_comment_details"
                        style={{
                          width: "100%",
                          backgroundColor: isFocusedComment ? "rgba(24, 144, 255, 0.08)" : undefined,
                          boxShadow: isFocusedComment ? "0 0 0 2px rgba(24, 144, 255, 0.15)" : undefined,
                          borderRadius: isFocusedComment ? "16px" : undefined,
                          padding: isFocusedComment ? "8px 10px" : undefined,
                        }}
                      >
                        <div className="_comment_details_top">
                          <div className="_comment_name">
                            <h4 className="_comment_name_title">{comment.authorName}</h4>
                          </div>
                        </div>
                        <div className="_comment_status">
                          <p className="_comment_status_text"><span>{comment.content}</span></p>
                        </div>

                        {(comment.replies || []).length > 0 && (
                          <div className="_replies_list" style={{ marginTop: "10px" }}>
                            {comment.replies.map((reply: any) => {
                              const isFocusedReply = focusReplyId === reply.id;
                              return (
                                <div
                                  id={`notification-reply-${reply.id}`}
                                  className="_comment_main"
                                  key={reply.id}
                                  style={{ marginBottom: "10px", padding: 0, marginTop: "10px", scrollMarginTop: "120px" }}
                                >
                                  <div className="_comment_image">
                                    <img src={reply.authorProfilePicture || "/assets/images/txt_img.png"} alt="" className="_comment_img1" style={{ borderRadius: "50%", objectFit: "cover", width: "24px", height: "24px" }} />
                                  </div>
                                  <div
                                    className="_comment_area"
                                    style={{
                                      flex: 1,
                                      width: "100%",
                                      padding: "8px 12px",
                                      borderRadius: "18px",
                                      backgroundColor: isFocusedReply ? "rgba(24, 144, 255, 0.12)" : "#f0f2f5",
                                      boxShadow: isFocusedReply ? "0 0 0 2px rgba(24, 144, 255, 0.15)" : undefined,
                                    }}
                                  >
                                    <div className="_comment_details_top">
                                      <div className="_comment_name"><h4 className="_comment_name_title" style={{ fontSize: "12px", margin: 0 }}>{reply.authorName}</h4></div>
                                    </div>
                                    <div className="_comment_status"><p className="_comment_status_text" style={{ fontSize: "14px", margin: 0 }}><span>{reply.content}</span></p></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
