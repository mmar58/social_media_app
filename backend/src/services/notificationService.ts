import express from "express";
import { Server } from "socket.io";
import db from "../db";

type NotificationType = "like_post" | "like_comment" | "comment" | "reply";

interface NotificationInput {
  recipientUserId: number;
  senderUserId: number;
  type: NotificationType;
  targetId: number;
}

export async function createNotification(app: express.Application, input: NotificationInput) {
  if (input.recipientUserId === input.senderUserId) {
    return null;
  }

  const [notificationId] = await db("notifications").insert({
    user_id: input.recipientUserId,
    sender_id: input.senderUserId,
    type: input.type,
    target_id: input.targetId,
  });

  const sender = await db("users")
    .select("first_name", "last_name", "profile_picture")
    .where({ id: input.senderUserId })
    .first();

  const payload = {
    id: notificationId,
    user_id: input.recipientUserId,
    sender_id: input.senderUserId,
    type: input.type,
    target_id: input.targetId,
    is_read: false,
    created_at: new Date(),
    senderName: `${sender?.first_name} ${sender?.last_name}`,
    senderProfile: sender?.profile_picture || null,
  };

  const io: Server = app.get("io");
  const socketMap: Map<number, Set<string>> = app.get("socketMap");
  const socketIds = socketMap.get(input.recipientUserId);

  if (socketIds && socketIds.size > 0) {
    for (const socketId of socketIds) {
      io.to(socketId).emit("notification", payload);
    }
  }

  return payload;
}