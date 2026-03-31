import { Router } from "express";
import db from "../db";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user.id;
    
    const posts = await db("posts")
      .select("posts.*", "users.first_name", "users.last_name", "users.profile_picture")
      .join("users", "posts.user_id", "users.id")
      .where(function() {
        this.where("visibility", "public").orWhere("posts.user_id", userId);
      })
      .orderBy("created_at", "desc");
      
    // Fetch likes and comments for posts
    for (const post of posts) {
      post.authorName = `${post.first_name} ${post.last_name}`;
      post.authorProfilePicture = post.profile_picture;
      
      const likes = await db("likes").where({ target_type: "post", target_id: post.id });
      post.likes = likes.length;
      post.isLiked = likes.some(l => l.user_id === userId);
      
      const comments = await db("comments")
        .select("comments.*", "users.first_name", "users.last_name", "users.profile_picture")
        .join("users", "comments.user_id", "users.id")
        .where({ post_id: post.id, parent_id: null })
        .orderBy("created_at", "asc");
        
      post.comments = comments.map(c => ({
        ...c,
        authorName: `${c.first_name} ${c.last_name}`,
        authorProfilePicture: c.profile_picture
      }));
    }

    res.json({ posts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const { content, visibility } = req.body;
    const userId = req.user.id;
    
    const [id] = await db("posts").insert({
      user_id: userId,
      content,
      visibility: visibility || "public"
    });
    
    const post = await db("posts")
      .select("posts.*", "users.first_name", "users.last_name", "users.profile_picture")
      .join("users", "posts.user_id", "users.id")
      .where("posts.id", id)
      .first();
      
    post.authorName = `${post.first_name} ${post.last_name}`;
    post.authorProfilePicture = post.profile_picture;
    post.likes = 0;
    post.isLiked = false;
    post.comments = [];
      
    res.json({ post });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/like", authenticate, async (req: AuthRequest, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;
    
    const existing = await db("likes").where({ user_id: userId, target_type: "post", target_id: postId }).first();
    
    if (existing) {
      await db("likes").where({ id: existing.id }).del();
      res.json({ action: "unliked" });
    } else {
      await db("likes").insert({ user_id: userId, target_type: "post", target_id: postId });
      res.json({ action: "liked" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/comment", authenticate, async (req: AuthRequest, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;
    const { content } = req.body;
    
    const [id] = await db("comments").insert({
      post_id: postId,
      user_id: userId,
      content
    });
    
    const comment = await db("comments")
      .select("comments.*", "users.first_name", "users.last_name")
      .join("users", "comments.user_id", "users.id")
      .where("comments.id", id)
      .first();
      
    comment.authorName = `${comment.first_name} ${comment.last_name}`;
      
    res.json({ comment });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
