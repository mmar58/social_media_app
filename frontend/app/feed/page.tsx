"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import Header from "../components/Header";
import CreatePostBox from "../components/CreatePostBox";
import Loader from "../components/Loader";
import PostItem from "../components/PostItem";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";

export default function FeedPage() {
  const socketRef = useRef<Socket | null>(null);
  const { user, loading, token } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    } else if (user && token) {
      fetchPosts();
      const socket = io("http://localhost:5000", { transports: ["websocket"] });
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
              return { ...p, comments: [...(p.comments || []), comment] };
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
        if (res.ok) setPosts(data.posts);
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
        socketRef.current?.emit("new_post", post);
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
              return { ...p, comments: [...(p.comments || []), comment] };
            }
            return p;
          })
        );
        socketRef.current?.emit("new_comment", { postId, comment });
      }
    } catch (err) {}
  };

  if (loading || !user) {
    return <Loader />;
  }

  return (
    <>
      <Header searchQuery={searchQuery} onSearch={handleSearch} />
      <div className="_layout _layout_main_wrapper" style={{ minHeight: "100vh", paddingTop: "80px" }}>
        <div className="_main_layout">
          <div className="container _custom_container">
            <div className="_layout_inner_wrap">
              <div className="row">
                {/* Left Sidebar */}
                <div className="col-xl-3 col-lg-3 col-md-12 col-sm-12">
                  <div className="_layout_left_sidebar_wrap">
                    <div className="_layout_left_sidebar_inner">
                      {/* Explore Section */}
                      <div className="_left_inner_area_explore _padd_t24 _padd_b6 _padd_r24 _padd_l24 _b_radious6 _feed_inner_area">
                        <h4 className="_left_inner_area_explore_title _title5 _mar_b24">Explore</h4>
                        <ul className="_left_inner_area_explore_list">
                          <li className="_left_inner_area_explore_item _explore_item">
                            <a href="#0" className="_left_inner_area_explore_link">
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 20 20"><path fill="#666" d="M10 0c5.523 0 10 4.477 10 10s-4.477 10-10 10S0 15.523 0 10 4.477 0 10 0z" /></svg>
                              Learning
                            </a>
                            <span className="_left_inner_area_explore_link_txt">New</span>
                          </li>
                          <li className="_left_inner_area_explore_item">
                            <a href="#0" className="_left_inner_area_explore_link">
                              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="24" fill="none" viewBox="0 0 22 24"><path fill="#666" d="M14.96 2c3.101 0 5.159 2.417 5.159 5.893v8.214c0 3.476-2.058 5.893-5.16 5.893H6.989c-3.101 0-5.159-2.417-5.159-5.893V7.893C1.83 4.42 3.892 2 6.988 2h7.972z" /></svg>
                              Insights
                            </a>
                          </li>
                          <li className="_left_inner_area_explore_item">
                            <a href="#0" className="_left_inner_area_explore_link">
                              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="24" fill="none" viewBox="0 0 22 24"><path fill="#666" d="M9.032 14.456l.297.002c4.404.041 6.907 1.03 6.907 3.678 0 2.586-2.383 3.573-6.615 3.654l-.589.005c-4.588 0-7.203-.972-7.203-3.68 0-2.704 2.604-3.659 7.203-3.659zM9.031 2c2.698 0 4.864 2.369 4.864 5.319 0 2.95-2.166 5.318-4.864 5.318-2.697 0-4.863-2.369-4.863-5.318C4.17 4.368 6.335 2 9.032 2z" /></svg>
                              Find friends
                            </a>
                          </li>
                          <li className="_left_inner_area_explore_item">
                            <a href="#0" className="_left_inner_area_explore_link">
                              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="24" fill="none" viewBox="0 0 22 24"><path fill="#666" d="M13.704 2c2.8 0 4.585 1.435 4.585 4.258V20.33c0 .443-.157.867-.436 1.18-.279.313-.658.489-1.063.489a1.456 1.456 0 01-.708-.203l-5.132-3.134-5.112 3.14c-.615.36-1.361.194-1.829-.405l-.09-.126-.085-.155a1.913 1.913 0 01-.176-.786V6.434C3.658 3.5 5.404 2 8.243 2h5.46z" /></svg>
                              Bookmarks
                            </a>
                          </li>
                          <li className="_left_inner_area_explore_item">
                            <a href="#0" className="_left_inner_area_explore_link">
                              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                              Group
                            </a>
                          </li>
                          <li className="_left_inner_area_explore_item">
                            <a href="#0" className="_left_inner_area_explore_link">
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path fill="#666" d="M12.616 2c.71 0 1.388.28 1.882.779.495.498.762 1.17.74 1.799l.009.147a1.046 1.046 0 00.66.928c.232.06.49.015.767-.123l.164-.082c1.23-.567 2.705-.117 3.387 1.043l.613 1.043c.017.027.03.056.043.085l.057.111a2.537 2.537 0 01-.884 3.204l-.257.159a1.093 1.093 0 00-.117 1.847c.078.287.27.53.56.695l.166.105c.505.346.869.855 1.028 1.439a2.404 2.404 0 01-.272 1.957l-.66 1.077-.1.152c-.774 1.092-2.279 1.425-3.427.776l-.136-.069a1.128 1.128 0 00-1.578 1.054l-.008.171C15.12 20.971 13.985 22 12.616 22h-1.235c-1.449 0-2.623-1.15-2.622-2.525l-.008-.147a1.045 1.045 0 00-.836-.893 1.12 1.12 0 00-.9.134l-.177.087a2.674 2.674 0 01-1.794.129 2.606 2.606 0 01-1.57-1.215l-.637-1.078-.085-.16a2.527 2.527 0 011.03-3.296l.104-.065c.309-.21.494-.554.494-.923 0-.401-.219-.772-.6-.989l-.156-.097a2.542 2.542 0 01-.764-3.407l.65-1.045a2.646 2.646 0 013.552-.96l.134.07c.135.06.283.093.425.094.626 0 1.137-.492 1.146-1.124l.009-.194a2.54 2.54 0 01.752-1.593A2.642 2.642 0 0111.381 2h1.235zm-.613 6.732c-1.842 0-3.336 1.463-3.336 3.268 0 1.805 1.494 3.268 3.336 3.268 1.842 0 3.336-1.463 3.336-3.268 0-1.805-1.494-3.268-3.336-3.268z" /></svg>
                              Settings
                            </a>
                          </li>
                          <li className="_left_inner_area_explore_item">
                            <a href="#0" className="_left_inner_area_explore_link">
                              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                              Save post
                            </a>
                          </li>
                        </ul>
                      </div>
                    </div>

                    {/* Suggested People */}
                    <div className="_layout_left_sidebar_inner">
                      <div className="_left_inner_area_suggest _padd_t24 _padd_b6 _padd_r24 _padd_l24 _b_radious6 _feed_inner_area">
                        <div className="_left_inner_area_suggest_content _mar_b24">
                          <h4 className="_left_inner_area_suggest_content_title _title5">Suggested People</h4>
                          <span className="_left_inner_area_suggest_content_txt">
                            <a className="_left_inner_area_suggest_content_txt_link" href="#0">See All</a>
                          </span>
                        </div>
                        {["Steve Jobs", "Ryan Roslansky", "Dylan Field"].map((name, i) => (
                          <div className="_left_inner_area_suggest_info" key={i}>
                            <div className="_left_inner_area_suggest_info_box">
                              <div className="_left_inner_area_suggest_info_image">
                                <a href="#0">
                                  <img src={`/assets/images/people${i + 1}.png`} alt={name} className={i === 0 ? "_info_img" : "_info_img1"} />
                                </a>
                              </div>
                              <div className="_left_inner_area_suggest_info_txt">
                                <a href="#0">
                                  <h4 className="_left_inner_area_suggest_info_title">{name}</h4>
                                </a>
                                <p className="_left_inner_area_suggest_info_para">
                                  {["CEO of Apple", "CEO of Linkedin", "CEO of Figma"][i]}
                                </p>
                              </div>
                            </div>
                            <div className="_left_inner_area_suggest_info_link">
                              <a href="#0" className="_info_link">Connect</a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Middle Column */}
                <div className="col-xl-6 col-lg-6 col-md-12 col-sm-12">
                  <div className="_layout_middle_wrap">
                    <div className="_layout_middle_inner">
                      <CreatePostBox onPost={handlePost} />

                      <div className="posts-container">
                        {posts.map((post) => (
                          <PostItem key={post.id} post={post} onLike={handleLike} onComment={handleComment} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Sidebar */}
                <div className="col-xl-3 col-lg-3 col-md-12 col-sm-12">
                  <div className="_layout_right_sidebar_wrap">
                    <div className="_layout_right_sidebar_inner">
                      {/* You Might Like */}
                      <div className="_right_inner_area_info _padd_t24 _padd_b24 _padd_r24 _padd_l24 _b_radious6 _feed_inner_area">
                        <div className="_right_inner_area_info_content _mar_b24">
                          <h4 className="_right_inner_area_info_content_title _title5">You Might Like</h4>
                          <span className="_right_inner_area_info_content_txt">
                            <a className="_right_inner_area_info_content_txt_link" href="#0">See All</a>
                          </span>
                        </div>
                        <hr className="_underline" />
                        <div className="_right_inner_area_info_ppl">
                          <div className="_right_inner_area_info_box">
                            <div className="_right_inner_area_info_box_image">
                              <a href="#0"><img src="/assets/images/Avatar.png" alt="Radovan" className="_ppl_img" /></a>
                            </div>
                            <div className="_right_inner_area_info_box_txt">
                              <a href="#0"><h4 className="_right_inner_area_info_box_title">Radovan SkillArena</h4></a>
                              <p className="_right_inner_area_info_box_para">Founder & CEO at Trophy</p>
                            </div>
                          </div>
                          <div className="_right_info_btn_grp">
                            <button type="button" className="_right_info_btn_link">Ignore</button>
                            <button type="button" className="_right_info_btn_link _right_info_btn_link_active">Follow</button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Your Friends */}
                    <div className="_layout_right_sidebar_inner">
                      <div className="_feed_right_inner_area_card _padd_t24 _padd_b6 _padd_r24 _padd_l24 _b_radious6 _feed_inner_area">
                        <div className="_feed_top_fixed">
                          <div className="_feed_right_inner_area_card_content _mar_b24">
                            <h4 className="_feed_right_inner_area_card_content_title _title5">Your Friends</h4>
                            <span className="_feed_right_inner_area_card_content_txt">
                              <a className="_feed_right_inner_area_card_content_txt_link" href="#0">See All</a>
                            </span>
                          </div>
                        </div>
                        <div className="_feed_bottom_fixed">
                          {[
                            { name: "Steve Jobs", title: "CEO of Apple", online: false, img: "people1.png" },
                            { name: "Ryan Roslansky", title: "CEO of Linkedin", online: true, img: "people2.png" },
                            { name: "Dylan Field", title: "CEO of Figma", online: true, img: "people3.png" },
                          ].map((friend, i) => (
                            <div
                              className={`_feed_right_inner_area_card_ppl${!friend.online ? " _feed_right_inner_area_card_ppl_inactive" : ""}`}
                              key={i}
                            >
                              <div className="_feed_right_inner_area_card_ppl_box">
                                <div className="_feed_right_inner_area_card_ppl_image">
                                  <a href="#0">
                                    <img src={`/assets/images/${friend.img}`} alt={friend.name} className="_box_ppl_img" />
                                  </a>
                                </div>
                                <div className="_feed_right_inner_area_card_ppl_txt">
                                  <a href="#0">
                                    <h4 className="_feed_right_inner_area_card_ppl_title">{friend.name}</h4>
                                  </a>
                                  <p className="_feed_right_inner_area_card_ppl_para">{friend.title}</p>
                                </div>
                              </div>
                              <div className="_feed_right_inner_area_card_ppl_side">
                                {friend.online ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 14 14">
                                    <rect width="12" height="12" x="1" y="1" fill="#0ACF83" stroke="#fff" strokeWidth="2" rx="6" />
                                  </svg>
                                ) : (
                                  <span>5 min ago</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
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
