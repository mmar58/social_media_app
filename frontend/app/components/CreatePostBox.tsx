"use client";

import React, { useState } from "react";

import { useAuth } from "../context/AuthContext";

export default function CreatePostBox({ onPost }: { onPost: (content: string, visibility: string) => void }) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState("public");

  const submit = () => {
    if (!content.trim()) return;
    onPost(content, visibility);
    setContent("");
  };

  return (
    <div className="_feed_inner_text_area _b_radious6 _padd_b24 _padd_t24 _padd_r24 _padd_l24 _mar_b16">
      <div className="_feed_inner_text_area_box">
        <div className="_feed_inner_text_area_box_image">
          <img src={user?.profile_picture || "/assets/images/txt_img.png"} alt="Image" className="_txt_img" style={{ borderRadius: "50%", objectFit: "cover", width: "40px", height: "40px" }} />
        </div>
        <div className="form-floating _feed_inner_text_area_box_form">
          <textarea 
            className="form-control _textarea" 
            placeholder="Leave a comment here" 
            id="floatingTextarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          ></textarea>
        </div>
      </div>
      <div className="_feed_inner_text_area_bottom">
        <div className="_feed_inner_text_area_item">
          <div className="_feed_inner_text_area_bottom_photo _feed_common">
            <select 
              className="_feed_inner_text_area_bottom_photo_link" 
              style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "5px" }}
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </div>
        </div>
        <div className="_feed_inner_text_area_btn">
          <button type="button" className="_feed_inner_text_area_btn_link" onClick={submit}>
            <span>Post</span> 
          </button>
        </div>
      </div>
    </div>
  );
}
