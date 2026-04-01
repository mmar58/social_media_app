import { Router } from "express";
import db from "../db";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

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

export default router;
