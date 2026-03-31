import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import authRoutes from "./routes/auth";
import postRoutes from "./routes/posts";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);

io.on("connection", (socket) => {
  console.log("Client connected", socket.id);

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
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
