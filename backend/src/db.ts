import knex from "knex";
import dotenv from "dotenv";

dotenv.config();

const db = knex({
  client: "mysql2",
  connection: {
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "123456",
    database: process.env.DB_NAME || "social_app",
  },
  pool: { min: 2, max: 10 },
});

export default db;
