import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import authRoutes from "./routes/auth";
import postRoutes from "./routes/posts";
import notificationsRoutes from "./routes/notifications";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/notifications", notificationsRoutes);

// expose io and a user->socket map to routes via app.locals
app.set("io", io);
app.set("socketMap", new Map<number, string>());

io.on("connection", (socket) => {
  console.log("Client connected", socket.id);
  const socketMap: Map<number, string> = app.get("socketMap");
  socket.on("new_post", (post) => {
    socket.broadcast.emit("receive_post", post);
  });

  socket.on("like_post", (data) => {
    socket.broadcast.emit("update_likes", data);
  });

  socket.on("new_comment", (data) => {
    socket.broadcast.emit("receive_comment", data);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected", socket.id);
    // remove from socket map
    const socketMap: Map<number, string> = app.get("socketMap");
    for (const [userId, sId] of socketMap.entries()) {
      if (sId === socket.id) socketMap.delete(userId);
    }
  });
  
  // allow client to register user id for private notifications
  socket.on("register", (userId: number) => {
    try {
      const socketMap: Map<number, string> = app.get("socketMap");
      socketMap.set(userId, socket.id);
      console.log("Registered user", userId, "->", socket.id);
    } catch (e) {
      console.error(e);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
