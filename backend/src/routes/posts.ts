import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import db from "../db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { createNotification } from "../services/notificationService";
import { hydratePosts } from "../services/postHydration";
import { validateBody, validateParams, validateQuery } from "../validation";
import {
  commentParamsSchema,
  commentPayloadSchema,
  createPostSchema,
  feedQuerySchema,
  postIdParamsSchema,
  replyParamsSchema,
} from "../validation/schemas";

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
    if (extOk && mimeOk) {
      cb(null, true);
      return;
    }

    cb(new Error("Only jpeg, jpg, png, gif, and webp images are allowed"));
  },
});

// GET /api/posts — supports ?search=term&limit=N&cursor=postId
router.get("/", authenticate, validateQuery(feedQuerySchema), async (req: AuthRequest, res) => {
  try {
    const userId = req.user.id;
    const search = ((req.query.search as string) || "").trim();
    const limit = Number(req.query.limit) || 50;
    const cursor = req.query.cursor ? Number(req.query.cursor) : null;

    let query = db("posts")
      .select("posts.*", "users.first_name", "users.last_name", "users.profile_picture")
      .join("users", "posts.user_id", "users.id")
      .where(function () {
        this.where("visibility", "public").orWhere("posts.user_id", userId);
      });

    if (cursor) {
      query = query.andWhere("posts.id", "<", cursor);
    }

    if (search.trim()) {
      query = query.andWhere(function () {
        this.where("posts.content", "like", `%${search}%`)
          .orWhere("users.first_name", "like", `%${search}%`)
          .orWhere("users.last_name", "like", `%${search}%`);
      });
    }

    const rawPosts = await query.orderBy("posts.id", "desc").limit(limit + 1);
    const hasMore = rawPosts.length > limit;
    const page = rawPosts.slice(0, limit);
    const posts = await hydratePosts(page, userId);
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

    res.json({ posts, nextCursor, hasMore });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/posts — supports multipart with optional image
router.post("/", authenticate, upload.single("image"), validateBody(createPostSchema), async (req: AuthRequest, res) => {
  try {
    const { content, visibility } = req.body;
    const userId = req.user.id;

    if (!req.file && !content.trim()) {
      return res.status(400).json({ error: "Post content is required when no image is provided" });
    }

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

    const rawPost = await db("posts")
      .select("posts.*", "users.first_name", "users.last_name", "users.profile_picture")
      .join("users", "posts.user_id", "users.id")
      .where("posts.id", id)
      .first();

    const [post] = await hydratePosts([rawPost], userId);

    res.json({ post });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/like", authenticate, validateParams(postIdParamsSchema), async (req: AuthRequest, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    const existing = await db("likes").where({ user_id: userId, target_type: "post", target_id: postId }).first();

    if (existing) {
      await db("likes").where({ id: existing.id }).del();
      res.json({ action: "unliked", likerProfilePicture: null, likerUserId: userId });
    } else {
      await db("likes").insert({ user_id: userId, target_type: "post", target_id: postId });

      const post = await db("posts").where({ id: postId }).first();
      if (post) {
        await createNotification(req.app, {
          recipientUserId: post.user_id,
          senderUserId: userId,
          type: "like_post",
          targetId: Number(postId),
        });
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

router.post("/:id/comment", authenticate, validateParams(postIdParamsSchema), validateBody(commentPayloadSchema), async (req: AuthRequest, res) => {
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
      .select("comments.*", "users.first_name", "users.last_name", "users.profile_picture")
      .join("users", "comments.user_id", "users.id")
      .where("comments.id", id)
      .first();

    comment.authorName = `${comment.first_name} ${comment.last_name}`;
    comment.authorProfilePicture = comment.profile_picture;
    comment.likes = 0;
    comment.isLiked = false;
    comment.replies = [];

    const post = await db("posts").where({ id: postId }).first();
    if (post) {
      await createNotification(req.app, {
        recipientUserId: post.user_id,
        senderUserId: userId,
        type: "comment",
        targetId: id,
      });
    }

    res.json({ comment });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/comments/:commentId/like", authenticate, validateParams(commentParamsSchema), async (req: AuthRequest, res) => {
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

      const comment = await db("comments").where({ id: commentId }).first();
      if (comment) {
        await createNotification(req.app, {
          recipientUserId: comment.user_id,
          senderUserId: userId,
          type: "like_comment",
          targetId: Number(commentId),
        });
      }

      res.json({ action: "liked", likerUserId: userId });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/comments/:commentId/reply", authenticate, validateParams(replyParamsSchema), validateBody(commentPayloadSchema), async (req: AuthRequest, res) => {
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

    const parent = await db("comments").where({ id: parentId }).first();
    if (parent) {
      await createNotification(req.app, {
        recipientUserId: parent.user_id,
        senderUserId: userId,
        type: "reply",
        targetId: id,
      });
    }

    res.json({ reply });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
