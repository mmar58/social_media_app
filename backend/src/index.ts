import dotenv from "dotenv";
import { createApp } from "./app";

dotenv.config();

const { server } = createApp();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
