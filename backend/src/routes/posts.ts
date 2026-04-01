import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import db from "../db";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// Configure multer for image uploads
const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extOk = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowedTypes.test(file.mimetype.split("/")[1]);
    cb(null, extOk && mimeOk);
  },
});

// GET /api/posts — supports ?search=term&limit=N
router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user.id;
    const search = (req.query.search as string) || "";
    const limit = parseInt(req.query.limit as string) || 50;

    let query = db("posts")
      .select("posts.*", "users.first_name", "users.last_name", "users.profile_picture")
      .join("users", "posts.user_id", "users.id")
      .where(function () {
        this.where("visibility", "public").orWhere("posts.user_id", userId);
      });

    if (search.trim()) {
      query = query.andWhere(function () {
        this.where("posts.content", "like", `%${search}%`)
          .orWhere("users.first_name", "like", `%${search}%`)
          .orWhere("users.last_name", "like", `%${search}%`);
      });
    }

    const posts = await query.orderBy("posts.created_at", "desc").limit(limit);

    // Fetch likes and comments for posts
    for (const post of posts) {
      post.authorName = `${post.first_name} ${post.last_name}`;
      post.authorProfilePicture = post.profile_picture;

      const likeRows = await db("likes")
        .select("likes.*", "users.first_name", "users.last_name", "users.profile_picture")
        .join("users", "likes.user_id", "users.id")
        .where({ "likes.target_type": "post", "likes.target_id": post.id })
        .orderBy("likes.created_at", "desc")
        .limit(8);
      post.likes = likeRows.length;
      post.isLiked = likeRows.some((l: any) => l.user_id === userId);
      post.likers = likeRows.map((l: any) => ({
        userId: l.user_id,
        profile_picture: l.profile_picture,
        name: `${l.first_name} ${l.last_name}`,
      }));

      const comments = await db("comments")
        .select("comments.*", "users.first_name", "users.last_name", "users.profile_picture")
        .join("users", "comments.user_id", "users.id")
        .where({ post_id: post.id })
        .orderBy("created_at", "asc");

      const commentIds = comments.map((c: any) => c.id);
      let commentLikes: any[] = [];
      if (commentIds.length > 0) {
        commentLikes = await db("likes")
          .where("target_type", "comment")
          .whereIn("target_id", commentIds);
      }

      const formattedComments = comments.map((c) => {
        const cLikes = commentLikes.filter((l) => l.target_id === c.id);
        return {
          ...c,
          authorName: `${c.first_name} ${c.last_name}`,
          authorProfilePicture: c.profile_picture,
          likes: cLikes.length,
          isLiked: cLikes.some((l) => l.user_id === userId),
          replies: [],
        };
      });

      const topLevelComments = formattedComments.filter((c) => c.parent_id === null);
      const replies = formattedComments.filter((c) => c.parent_id !== null);

      replies.forEach((reply) => {
        const parent = topLevelComments.find((p) => p.id === reply.parent_id);
        if (parent) {
          parent.replies.push(reply);
        }
      });

      post.comments = topLevelComments;
    }

    res.json({ posts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/posts — supports multipart with optional image
router.post("/", authenticate, upload.single("image"), async (req: AuthRequest, res) => {
  try {
    const { content, visibility } = req.body;
    const userId = req.user.id;

    let image_url: string | null = null;
    if (req.file) {
      image_url = `/uploads/${req.file.filename}`;
    }

    const [id] = await db("posts").insert({
      user_id: userId,
      content,
      image_url,
      visibility: visibility || "public",
    });

    const post = await db("posts")
      .select("posts.*", "users.first_name", "users.last_name", "users.profile_picture")
      .join("users", "posts.user_id", "users.id")
      .where("posts.id", id)
      .first();

    post.authorName = `${post.first_name} ${post.last_name}`;
    post.authorProfilePicture = post.profile_picture;
    post.likes = 0;
    post.likers = [];
    post.isLiked = false;
    post.comments = [];
    post.totalLikes = 0;

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
      res.json({ action: "unliked", likerProfilePicture: null, likerUserId: userId });
    } else {
      await db("likes").insert({ user_id: userId, target_type: "post", target_id: postId });

      // notify post owner
      try {
        const post = await db("posts").where({ id: postId }).first();
        if (post && post.user_id !== userId) {
          const [nid] = await db("notifications").insert({
            user_id: post.user_id,
            sender_id: userId,
            type: "like_post",
            target_id: postId,
          });

          const io = req.app.get("io");
          const socketMap: Map<number, string> = req.app.get("socketMap");
          const socketId = socketMap.get(post.user_id);
          const sender = await db("users").select("first_name", "last_name", "profile_picture").where({ id: userId }).first();
          const notification = {
            id: nid,
            user_id: post.user_id,
            sender_id: userId,
            type: "like_post",
            target_id: postId,
            is_read: false,
            created_at: new Date(),
            senderName: `${sender?.first_name} ${sender?.last_name}`,
            senderProfile: sender?.profile_picture || null,
          };
          if (socketId) io.to(socketId).emit("notification", notification);
          else io.emit("notification", notification);
        }
      } catch (e) {
        console.error(e);
      }

      const liker = await db("users").select("profile_picture", "first_name", "last_name").where({ id: userId }).first();
      res.json({
        action: "liked",
        likerProfilePicture: liker?.profile_picture || null,
        likerUserId: userId,
        likerName: `${liker?.first_name} ${liker?.last_name}`,
      });
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
      content,
    });

    const comment = await db("comments")
      .select("comments.*", "users.first_name", "users.last_name")
      .join("users", "comments.user_id", "users.id")
      .where("comments.id", id)
      .first();

    comment.authorName = `${comment.first_name} ${comment.last_name}`;
    comment.authorProfilePicture = comment.profile_picture;

    // notify post owner
    try {
      const post = await db("posts").where({ id: postId }).first();
      if (post && post.user_id !== userId) {
        const [nid] = await db("notifications").insert({
          user_id: post.user_id,
          sender_id: userId,
          type: "comment",
          target_id: id,
        });

        const io = req.app.get("io");
        const socketMap: Map<number, string> = req.app.get("socketMap");
        const socketId = socketMap.get(post.user_id);
        const sender = await db("users").select("first_name", "last_name", "profile_picture").where({ id: userId }).first();
        const notification = {
          id: nid,
          user_id: post.user_id,
          sender_id: userId,
          type: "comment",
          target_id: id,
          is_read: false,
          created_at: new Date(),
          senderName: `${sender?.first_name} ${sender?.last_name}`,
          senderProfile: sender?.profile_picture || null,
        };
        if (socketId) io.to(socketId).emit("notification", notification);
        else io.emit("notification", notification);
      }
    } catch (e) {
      console.error(e);
    }

    res.json({ comment });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/comments/:commentId/like", authenticate, async (req: AuthRequest, res) => {
  try {
    const commentId = req.params.commentId;
    const userId = req.user.id;

    const existing = await db("likes")
      .where({ user_id: userId, target_type: "comment", target_id: commentId })
      .first();

    if (existing) {
      await db("likes").where({ id: existing.id }).del();
      res.json({ action: "unliked", likerUserId: userId });
    } else {
      await db("likes").insert({ user_id: userId, target_type: "comment", target_id: commentId });

      // notify comment owner
      try {
        const comment = await db("comments").where({ id: commentId }).first();
        if (comment && comment.user_id !== userId) {
          const [nid] = await db("notifications").insert({
            user_id: comment.user_id,
            sender_id: userId,
            type: "like_comment",
            target_id: commentId,
          });

          const io = req.app.get("io");
          const socketMap: Map<number, string> = req.app.get("socketMap");
          const socketId = socketMap.get(comment.user_id);
          const sender = await db("users").select("first_name", "last_name", "profile_picture").where({ id: userId }).first();
          const notification = {
            id: nid,
            user_id: comment.user_id,
            sender_id: userId,
            type: "like_comment",
            target_id: commentId,
            is_read: false,
            created_at: new Date(),
            senderName: `${sender?.first_name} ${sender?.last_name}`,
            senderProfile: sender?.profile_picture || null,
          };
          if (socketId) io.to(socketId).emit("notification", notification);
          else io.emit("notification", notification);
        }
      } catch (e) {
        console.error(e);
      }

      res.json({ action: "liked", likerUserId: userId });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/comments/:commentId/reply", authenticate, async (req: AuthRequest, res) => {
  try {
    const postId = req.params.id;
    const parentId = req.params.commentId;
    const userId = req.user.id;
    const { content } = req.body;

    const [id] = await db("comments").insert({
      post_id: postId,
      user_id: userId,
      parent_id: parentId,
      content,
    });

    const reply = await db("comments")
      .select("comments.*", "users.first_name", "users.last_name", "users.profile_picture")
      .join("users", "comments.user_id", "users.id")
      .where("comments.id", id)
      .first();

    reply.authorName = `${reply.first_name} ${reply.last_name}`;
    reply.authorProfilePicture = reply.profile_picture;
    reply.likes = 0;
    reply.isLiked = false;
    reply.replies = [];

    // notify parent comment owner
    try {
      const parent = await db('comments').where({ id: parentId }).first();
      if (parent && parent.user_id !== userId) {
        const [nid] = await db('notifications').insert({
          user_id: parent.user_id,
          sender_id: userId,
          type: 'reply',
          target_id: id,
        });

        const io = req.app.get("io");
        const socketMap: Map<number, string> = req.app.get("socketMap");
        const socketId = socketMap.get(parent.user_id);
        const sender = await db("users").select("first_name", "last_name", "profile_picture").where({ id: userId }).first();
        const notification = {
          id: nid,
          user_id: parent.user_id,
          sender_id: userId,
          type: 'reply',
          target_id: id,
          is_read: false,
          created_at: new Date(),
          senderName: `${sender?.first_name} ${sender?.last_name}`,
          senderProfile: sender?.profile_picture || null,
        };
        if (socketId) io.to(socketId).emit("notification", notification);
        else io.emit("notification", notification);
      }
    } catch (e) {
      console.error(e);
    }

    res.json({ reply });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
