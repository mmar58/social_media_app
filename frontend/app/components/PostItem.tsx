"use client";

import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function PostItem({ post, onLike, onComment, onCommentLike, onCommentReply }: any) {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    if (onComment) await onComment(post.id, commentText);
    setCommentText("");
  };

  const handleReplySubmit = async (e: React.FormEvent, commentId: number) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    if (onCommentReply) await onCommentReply(post.id, commentId, replyText);
    setReplyText("");
    setReplyingTo(null);
  };

  return (
    <div className="_feed_inner_timeline_post_area _b_radious6 _padd_b24 _padd_t24 _mar_b16">
      {/* Post Header */}
      <div className="_feed_inner_timeline_content _padd_r24 _padd_l24">
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
                {post.created_at
                  ? new Date(post.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "Just now"}{" "}
                . <a href="#0">{post.visibility === "private" ? "Private" : "Public"}</a>
              </p>
            </div>
          </div>

          {/* Three-dot dropdown */}
          <div className="_feed_inner_timeline_post_box_dropdown">
            <div className="_feed_timeline_post_dropdown">
              <button className="_feed_timeline_post_dropdown_link">
                <svg xmlns="http://www.w3.org/2000/svg" width="4" height="17" fill="none" viewBox="0 0 4 17">
                  <circle cx="2" cy="2" r="2" fill="#C4C4C4" />
                  <circle cx="2" cy="8" r="2" fill="#C4C4C4" />
                  <circle cx="2" cy="15" r="2" fill="#C4C4C4" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Post Content */}
        <h4 className="_feed_inner_timeline_post_title">{post.content}</h4>

        {/* Post Image */}
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

      {/* Reaction Counts Row */}
      <div className="_feed_inner_timeline_total_reacts _padd_r24 _padd_l24 _mar_b26">
        <div className="_feed_inner_timeline_total_reacts_image">
          {post.likers && post.likers.slice(0, 8).map((liker: any, i: number) => (
            <img
              key={liker.userId ?? i}
              src={liker.profile_picture || "/assets/images/react_img1.png"}
              alt={liker.name || ""}
              title={liker.name || ""}
              className={i === 0 ? "_react_img1" : "_react_img _rect_img_mbl_none"}
              style={{ borderRadius: "50%", objectFit: "cover", width: "24px", height: "24px" }}
            />
          ))}
          {/* Always show total likes count */}
          {post.likes > 0 && (
            <p className="_feed_inner_timeline_total_reacts_para">{post.likes}</p>
          )}
        </div>
        <div className="_feed_inner_timeline_total_reacts_txt">
          <p className="_feed_inner_timeline_total_reacts_para1">
            <a href="#0" onClick={(e) => { e.preventDefault(); setShowComments(!showComments); }}>
              <span>{post.comments?.length || 0}</span> Comment
            </a>
          </p>
          <p className="_feed_inner_timeline_total_reacts_para2"><span>0</span> Share</p>
        </div>
      </div>

      {/* Reaction Buttons */}
      <div className="_feed_inner_timeline_reaction">
        {/* Like / Emoji button */}
        <button
          className={`_feed_inner_timeline_reaction_emoji _feed_reaction${post.isLiked ? " _feed_reaction_active" : ""}`}
          onClick={() => onLike(post.id)}
        >
          <span className="_feed_inner_timeline_reaction_link">
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" fill="none" viewBox="0 0 19 19">
                <path fill={post.isLiked ? "#FFCC4D" : "#ccc"} d="M9.5 19a9.5 9.5 0 100-19 9.5 9.5 0 000 19z" />
                <path fill="#664500" d="M9.5 11.083c-1.912 0-3.181-.222-4.75-.527-.358-.07-1.056 0-1.056 1.055 0 2.111 2.425 4.75 5.806 4.75 3.38 0 5.805-2.639 5.805-4.75 0-1.055-.697-1.125-1.055-1.055-1.57.305-2.838.527-4.75.527z" />
                <path fill="#fff" d="M4.75 11.611s1.583.528 4.75.528 4.75-.528 4.75-.528-1.056 2.111-4.75 2.111-4.75-2.11-4.75-2.11z" />
                <path fill="#664500" d="M6.333 8.972c.729 0 1.32-.827 1.32-1.847s-.591-1.847-1.32-1.847c-.729 0-1.32.827-1.32 1.847s.591 1.847 1.32 1.847zM12.667 8.972c.729 0 1.32-.827 1.32-1.847s-.591-1.847-1.32-1.847c-.729 0-1.32.827-1.32 1.847s.591 1.847 1.32 1.847z" />
              </svg>
              {post.isLiked ? "Haha" : "Like"}
            </span>
          </span>
        </button>

        {/* Comment button */}
        <button
          className="_feed_inner_timeline_reaction_comment _feed_reaction"
          onClick={() => setShowComments(!showComments)}
        >
          <span className="_feed_inner_timeline_reaction_link">
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <svg className="_reaction_svg" xmlns="http://www.w3.org/2000/svg" width="21" height="21" fill="none" viewBox="0 0 21 21">
                <path stroke="#000" d="M1 10.5c0-.464 0-.696.009-.893A9 9 0 019.607 1.01C9.804 1 10.036 1 10.5 1v0c.464 0 .696 0 .893.009a9 9 0 018.598 8.598c.009.197.009.429.009.893v6.046c0 1.36 0 2.041-.317 2.535a2 2 0 01-.602.602c-.494.317-1.174.317-2.535.317H10.5c-.464 0-.696 0-.893-.009a9 9 0 01-8.598-8.598C1 11.196 1 10.964 1 10.5v0z" />
                <path stroke="#000" strokeLinecap="round" strokeLinejoin="round" d="M6.938 9.313h7.125M10.5 14.063h3.563" />
              </svg>
              Comment
            </span>
          </span>
        </button>

        {/* Share button */}
        <button className="_feed_inner_timeline_reaction_share _feed_reaction">
          <span className="_feed_inner_timeline_reaction_link">
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <svg className="_reaction_svg" xmlns="http://www.w3.org/2000/svg" width="24" height="21" fill="none" viewBox="0 0 24 21">
                <path stroke="#000" strokeLinejoin="round" d="M23 10.5L12.917 1v5.429C3.267 6.429 1 13.258 1 20c2.785-3.52 5.248-5.429 11.917-5.429V20L23 10.5z" />
              </svg>
              Share
            </span>
          </span>
        </button>
      </div>

      {/* Comment Area */}
      <div className="_feed_inner_timeline_cooment_area">
        {/* Comment Input */}
        <div className="_feed_inner_comment_box">
          <form className="_feed_inner_comment_box_form" onSubmit={handleCommentSubmit}>
            <div className="_feed_inner_comment_box_content">
              <div className="_feed_inner_comment_box_content_image">
                <img
                  src={user?.profile_picture || "/assets/images/comment_img.png"}
                  alt=""
                  className="_comment_img"
                  style={{ borderRadius: "50%", objectFit: "cover" }}
                />
              </div>
              <div className="_feed_inner_comment_box_content_txt">
                <textarea
                  className="form-control _comment_textarea"
                  placeholder="Write a comment"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                ></textarea>
              </div>
            </div>
            <div className="_feed_inner_comment_box_icon">
              <button type="submit" className="_feed_inner_comment_box_icon_btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16">
                  <path fill="#1890FF" fillRule="evenodd" d="M14.5 8L8 1.5 1.5 8H6v6h4V8h4.5z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Comments List */}
      {showComments && post.comments?.length > 0 && (
          <div className="_timline_comment_main">
            <div className="_previous_comment">
              {!showAllComments && post.comments.length > 2 && (
                <button type="button" className="_previous_comment_txt" onClick={() => setShowAllComments(true)}>
                  View {post.comments.length - 2} previous comments
                </button>
              )}
            </div>
            {(showAllComments ? post.comments : post.comments.slice(-2)).map((c: any) => (
              <div className="_comment_main" key={c.id}>
                <div className="_comment_image">
                  <a href="#0" className="_comment_image_link">
                    <img
                      src={c.authorProfilePicture || "/assets/images/txt_img.png"}
                      alt=""
                      className="_comment_img1"
                      style={{ borderRadius: "50%", objectFit: "cover" }}
                    />
                  </a>
                </div>
                <div className="_comment_area" style={{ flex: 1, width: "100%" }}>
                  <div className="_comment_details" style={{ width: "100%" }}>
                    <div className="_comment_details_top">
                      <div className="_comment_name">
                        <a href="#0">
                          <h4 className="_comment_name_title">{c.authorName}</h4>
                        </a>
                      </div>
                    </div>
                    <div className="_comment_status">
                      <p className="_comment_status_text"><span>{c.content}</span></p>
                    </div>
                    {c.likes > 0 && (
                      <div className="_total_reactions">
                        <div className="_total_react">
                          <span className="_reaction_like">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={c.isLiked ? "#1890FF" : "none"} stroke={c.isLiked ? "#1890FF" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-thumbs-up"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                          </span>
                        </div>
                        <span className="_total">
                          {c.likes}
                        </span>
                      </div>
                    )}
                    <div className="_comment_reply">
                      <div className="_comment_reply_num">
                        <ul className="_comment_reply_list">
                          <li><span style={{ cursor: "pointer", color: c.isLiked ? "#1890FF" : "inherit" }} onClick={() => onCommentLike && onCommentLike(post.id, c.id)}>Like.</span></li>
                          <li><span style={{ cursor: "pointer" }} onClick={() => { setReplyingTo(replyingTo === c.id ? null : c.id); setReplyText(""); }}>Reply.</span></li>
                          <li><span className="_time_link">.{c.created_at ? new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "now"}</span></li>
                        </ul>
                      </div>
                    </div>

                    {replyingTo === c.id && (
                      <div className="_feed_inner_comment_box" style={{ marginTop: "10px", padding: 0 }}>
                        <form className="_feed_inner_comment_box_form" onSubmit={(e) => handleReplySubmit(e, c.id)}>
                          <div className="_feed_inner_comment_box_content_txt" style={{flex: 1, padding: "0 10px"}}>
                            <input
                              autoFocus
                              type="text"
                              className="form-control _comment_textarea"
                              placeholder="Write a reply..."
                              style={{ height: "36px", borderRadius: "18px", padding: "0 15px", backgroundColor: "#f0f2f5", border: "none", width: "100%" }}
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                            />
                          </div>
                          <div className="_feed_inner_comment_box_icon">
                            <button type="submit" className="_feed_inner_comment_box_icon_btn">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16">
                                <path fill="#1890FF" fillRule="evenodd" d="M14.5 8L8 1.5 1.5 8H6v6h4V8h4.5z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                    {c.replies?.length > 0 && (
                      <div className="_replies_list" style={{ marginTop: "10px" }}>
                        {c.replies.map((reply: any) => (
                          <div className="_comment_main" key={reply.id} style={{ marginBottom: "10px", padding: 0, marginTop: "10px" }}>
                            <div className="_comment_image">
                              <img src={reply.authorProfilePicture || "/assets/images/txt_img.png"} alt="" className="_comment_img1" style={{ borderRadius: "50%", objectFit: "cover", width: "24px", height: "24px" }} />
                            </div>
                            <div className="_comment_area" style={{ flex: 1, width: "100%", padding: "8px 12px", borderRadius: "18px", backgroundColor: "#f0f2f5" }}>
                              <div className="_comment_details_top">
                                <div className="_comment_name"><a href="#0"><h4 className="_comment_name_title" style={{ fontSize: "12px", margin: 0 }}>{reply.authorName}</h4></a></div>
                              </div>
                              <div className="_comment_status"><p className="_comment_status_text" style={{ fontSize: "14px", margin: 0 }}><span>{reply.content}</span></p></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
