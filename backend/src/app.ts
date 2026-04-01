import cors from "cors";
import express from "express";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import authRoutes from "./routes/auth";
import notificationsRoutes from "./routes/notifications";
import postRoutes from "./routes/posts";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: "*" },
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/posts", postRoutes);
  app.use("/api/notifications", notificationsRoutes);

  app.set("io", io);
  app.set("socketMap", new Map<number, string>());

  io.on("connection", (socket) => {
    const socketMap: Map<number, string> = app.get("socketMap");

    socket.on("new_post", (post) => {
      if (post?.visibility === "public") {
        socket.broadcast.emit("receive_post", post);
      }
    });

    socket.on("like_post", (data) => {
      socket.broadcast.emit("update_likes", data);
    });

    socket.on("new_comment", (data) => {
      socket.broadcast.emit("receive_comment", data);
    });

    socket.on("disconnect", () => {
      for (const [userId, socketId] of socketMap.entries()) {
        if (socketId === socket.id) {
          socketMap.delete(userId);
        }
      }
    });

    socket.on("register", (userId: number) => {
      socketMap.set(userId, socket.id);
    });
  });

  return { app, server, io };
}