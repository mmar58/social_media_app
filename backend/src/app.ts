import cors from "cors";
import express from "express";
import http from "http";
import path from "path";
import multer from "multer";
import { Server } from "socket.io";
import authRoutes from "./routes/auth";
import notificationsRoutes from "./routes/notifications";
import postRoutes from "./routes/posts";

export function createApp() {
  const app = express();
  const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
  app.use(cors({ origin: frontendOrigin, credentials: true }));
  app.use(express.json());
  app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: frontendOrigin, credentials: true },
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/posts", postRoutes);
  app.use("/api/notifications", notificationsRoutes);

  app.set("io", io);
  app.set("socketMap", new Map<number, Set<string>>());

  io.on("connection", (socket) => {
    const socketMap: Map<number, Set<string>> = app.get("socketMap");

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
      for (const [userId, socketIds] of socketMap.entries()) {
        if (socketIds.has(socket.id)) {
          socketIds.delete(socket.id);
          if (socketIds.size === 0) {
            socketMap.delete(userId);
          }
        }
      }
    });

    socket.on("register", (userId: number) => {
      const userSockets = socketMap.get(userId) || new Set<string>();
      userSockets.add(socket.id);
      socketMap.set(userId, userSockets);
    });
  });

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "Image uploads must be 5MB or smaller" });
      }
      return res.status(400).json({ error: err.message });
    }

    if (err instanceof Error) {
      return res.status(400).json({ error: err.message });
    }

    return res.status(500).json({ error: "Internal server error" });
  });

  return { app, server, io };
}