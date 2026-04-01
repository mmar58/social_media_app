import { Router } from "express";
import db from "../db";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

async function hydratePost(postId: number, viewerId: number) {
  const post = await db("posts")
    .select("posts.*", "users.first_name", "users.last_name", "users.profile_picture")
    .join("users", "posts.user_id", "users.id")
    .where("posts.id", postId)
    .first();

  if (!post) return null;

  post.authorName = `${post.first_name} ${post.last_name}`;
  post.authorProfilePicture = post.profile_picture;

  const likeRows = await db("likes")
    .select("likes.*", "users.first_name", "users.last_name", "users.profile_picture")
    .join("users", "likes.user_id", "users.id")
    .where({ "likes.target_type": "post", "likes.target_id": post.id })
    .orderBy("likes.created_at", "desc")
    .limit(8);

  post.likes = likeRows.length;
  post.isLiked = likeRows.some((likeRow: any) => likeRow.user_id === viewerId);
  post.likers = likeRows.map((likeRow: any) => ({
    userId: likeRow.user_id,
    profile_picture: likeRow.profile_picture,
    name: `${likeRow.first_name} ${likeRow.last_name}`,
  }));

  const comments = await db("comments")
    .select("comments.*", "users.first_name", "users.last_name", "users.profile_picture")
    .join("users", "comments.user_id", "users.id")
    .where({ post_id: post.id })
    .orderBy("created_at", "asc");

  const commentIds = comments.map((comment: any) => comment.id);
  let commentLikes: any[] = [];
  if (commentIds.length > 0) {
    commentLikes = await db("likes")
      .where("target_type", "comment")
      .whereIn("target_id", commentIds);
  }

  const formattedComments = comments.map((comment: any) => {
    const likesForComment = commentLikes.filter((likeRow) => likeRow.target_id === comment.id);
    return {
      ...comment,
      authorName: `${comment.first_name} ${comment.last_name}`,
      authorProfilePicture: comment.profile_picture,
      likes: likesForComment.length,
      isLiked: likesForComment.some((likeRow) => likeRow.user_id === viewerId),
      replies: [],
    };
  });

  const topLevelComments = formattedComments.filter((comment: any) => comment.parent_id === null);
  const replies = formattedComments.filter((comment: any) => comment.parent_id !== null);

  replies.forEach((reply: any) => {
    const parent = topLevelComments.find((comment: any) => comment.id === reply.parent_id);
    if (parent) parent.replies.push(reply);
  });

  post.comments = topLevelComments;
  return post;
}

// GET /api/notifications - list notifications for authenticated user
router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user.id;
    const notis = await db("notifications")
      .select("notifications.*", "u.first_name as sender_first", "u.last_name as sender_last", "u.profile_picture as sender_profile")
      .leftJoin("users as u", "notifications.sender_id", "u.id")
      .where({ "notifications.user_id": userId })
      .orderBy("notifications.created_at", "desc")
      .limit(100);

    const unreadCountRow = await db("notifications").where({ user_id: userId, is_read: false }).count("id as cnt").first();
    const unreadCount = unreadCountRow ? unreadCountRow.cnt : 0;

    const formatted = notis.map((n: any) => ({
      id: n.id,
      type: n.type,
      target_id: n.target_id,
      is_read: !!n.is_read,
      created_at: n.created_at,
      senderName: `${n.sender_first} ${n.sender_last}`,
      senderProfile: n.sender_profile,
    }));

    res.json({ notifications: formatted, unread: unreadCount });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/notifications/mark-all-read
router.post("/mark-all-read", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user.id;
    await db("notifications").where({ user_id: userId }).update({ is_read: true });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/notifications/:id/read
router.post("/:id/read", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user.id;
    const id = req.params.id;
    await db("notifications").where({ id, user_id: userId }).update({ is_read: true });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/notifications/:id/details
router.get("/:id/details", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user.id;
    const id = Number(req.params.id);

    const notification = await db("notifications").where({ id, user_id: userId }).first();
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    let postId: number | null = null;
    let focusCommentId: number | null = null;
    let focusReplyId: number | null = null;

    if (notification.type === "like_post") {
      postId = Number(notification.target_id);
    } else {
      const comment = await db("comments").where({ id: notification.target_id }).first();
      if (!comment) {
        return res.status(404).json({ error: "Notification target not found" });
      }

      postId = Number(comment.post_id);
      if (comment.parent_id) {
        focusCommentId = Number(comment.parent_id);
        focusReplyId = Number(comment.id);
      } else {
        focusCommentId = Number(comment.id);
      }
    }

    const post = await hydratePost(postId, userId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.json({ post, focusCommentId, focusReplyId, type: notification.type });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
