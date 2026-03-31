"use client";

import React, { useState } from "react";

export default function PostItem({ post, onLike }: any) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");

  return (
    <div className="_feed_inner_timeline_post_area _b_radious6 _padd_b24 _padd_t24 _mar_b16">
      <div className="_feed_inner_timeline_content _padd_r24 _padd_l24">
        <div className="_feed_inner_timeline_post_top">
          <div className="_feed_inner_timeline_post_box">
            <div className="_feed_inner_timeline_post_box_image">
              <img src="/assets/images/post_img.png" alt="" className="_post_img" />
            </div>
            <div className="_feed_inner_timeline_post_box_txt">
              <h4 className="_feed_inner_timeline_post_box_title">{post.authorName}</h4>
              <p className="_feed_inner_timeline_post_box_para">
                Just now . <a href="#0">{post.visibility}</a>
              </p>
            </div>
          </div>
        </div>
        <h4 className="_feed_inner_timeline_post_title">{post.content}</h4>
      </div>
      
      <div className="_feed_inner_timeline_total_reacts _padd_r24 _padd_l24 _mar_b26" style={{ marginTop: 20 }}>
        <div className="_feed_inner_timeline_total_reacts_image">
          <p className="_feed_inner_timeline_total_reacts_para">{post.likes} Likes</p>
        </div>
        <div className="_feed_inner_timeline_total_reacts_txt">
          <p className="_feed_inner_timeline_total_reacts_para1" onClick={() => setShowComments(!showComments)} style={{ cursor: "pointer" }}>
            <span>{post.comments?.length || 0}</span> Comments
          </p>
        </div>
      </div>
      
      <div className="_feed_inner_timeline_reaction">
        <button className={"_feed_inner_timeline_reaction_emoji _feed_reaction " + (post.isLiked ? "_feed_reaction_active" : "")} onClick={() => onLike(post.id)}>
          <span className="_feed_inner_timeline_reaction_link">Like</span>
        </button>
        <button className="_feed_inner_timeline_reaction_comment _feed_reaction" onClick={() => setShowComments(!showComments)}>
          <span className="_feed_inner_timeline_reaction_link">Comment</span>
        </button>
      </div>

      {showComments && (
        <div className="_feed_inner_timeline_cooment_area" style={{ padding: "0 24px" }}>
          <div className="_feed_inner_comment_box" style={{ marginTop: "16px" }}>
            <div className="_feed_inner_comment_box_content">
              <div className="_feed_inner_comment_box_content_txt" style={{ width: "100%" }}>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Write a comment..." 
                  value={commentText} 
                  onChange={(e) => setCommentText(e.target.value)}
                  style={{ borderRadius: "20px", padding: "10px 20px" }}
                />
              </div>
            </div>
            <div className="_feed_inner_comment_box_icon" style={{ marginLeft: "10px" }}>
              <button className="btn btn-primary" style={{ borderRadius: "20px" }}>Send</button>
            </div>
          </div>
          <div className="_comment_main" style={{ marginTop: "20px" }}>
            {post.comments?.map((c: any) => (
              <div key={c.id} style={{ marginBottom: "16px" }}>
                <strong>{c.authorName}</strong>
                <p>{c.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
