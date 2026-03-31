"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import Header from "../components/Header";
import CreatePostBox from "../components/CreatePostBox";
import Loader from "../components/Loader";
import PostItem from "../components/PostItem";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";

let socket: Socket;

export default function FeedPage() {
  const { user, loading, token } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    } else if (user && token) {
      fetchPosts();
      
      socket = io("http://localhost:5000");
      socket.on("receive_post", (newPost) => {
        setPosts((prev) => [newPost, ...prev]);
      });
      socket.on("update_likes", ({ postId, action }) => {
        setPosts((prev) => prev.map(p => {
          if (p.id === Number(postId)) {
             return { ...p, likes: action === "liked" ? p.likes + 1 : p.likes - 1 };
          }
          return p;
        }));
      });

      return () => {
        socket.disconnect();
      }
    }
  }, [user, loading, router, token]);

  const fetchPosts = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/posts", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setPosts(data.posts);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePost = async (content: string, visibility: string) => {
    try {
      const res = await fetch("http://localhost:5000/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content, visibility }),
      });
      if (res.ok) {
        const { post } = await res.json();
        setPosts([post, ...posts]);
        socket?.emit("new_post", post);
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
        setPosts(posts.map(p => {
          if (p.id === id) {
            return { ...p, isLiked: data.action === "liked", likes: data.action === "liked" ? p.likes + 1 : p.likes - 1 };
          }
          return p;
        }));
        socket?.emit("like_post", { postId: id, action: data.action });
      }
    } catch (err) {}
  };

  if (loading || !user) {
    return <Loader />;
  }

  return (
    <>
      <Header />
      <div className="_layout _layout_main_wrapper" style={{ minHeight: "100vh", paddingTop: "80px" }}>
        <div className="_main_layout">
          <div className="container _custom_container">
            <div className="_layout_inner_wrap">
              <div className="row">
                <div className="col-xl-3 col-lg-3 col-md-12 col-sm-12">
                  <div className="_layout_left_sidebar_wrap">
                    <div className="_left_inner_area_explore _padd_t24 _padd_b6 _padd_r24 _padd_l24 _b_radious6 _feed_inner_area">
                      <h4 className="_left_inner_area_explore_title _title5 _mar_b24">Explore</h4>
                      <p>Use the feed area to post updates.</p>
                    </div>
                  </div>
                </div>

                <div className="col-xl-6 col-lg-6 col-md-12 col-sm-12">
                  <div className="_layout_middle_wrap">
                    <div className="_layout_middle_inner">
                      <CreatePostBox onPost={handlePost} />
                      
                      <div className="posts-container">
                        {posts.map((post) => (
                          <PostItem key={post.id} post={post} onLike={handleLike} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-xl-3 col-lg-3 col-md-12 col-sm-12">
                  <div className="_layout_right_sidebar_wrap">
                    <div className="_right_inner_area_info _padd_t24 _padd_b24 _padd_r24 _padd_l24 _b_radious6 _feed_inner_area">
                      <div className="_right_inner_area_info_content _mar_b24">
                        <h4 className="_right_inner_area_info_content_title _title5">You Might Like</h4>
                        <span>No suggestions right now.</span>
                      </div>
                    </div>
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
