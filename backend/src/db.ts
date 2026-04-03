import knex from "knex";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

function getDatabaseSslConfig() {
  const ca = process.env.DB_SSL_CA?.trim().replace(/\\n/g, "\n");
  const caPath = process.env.DB_SSL_CA_PATH?.trim();

  if (!ca && !caPath) {
    return undefined;
  }

  const sslCa = ca || fs.readFileSync(caPath!, "utf8");

  return {
    ca: sslCa,
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
  };
}

const db = knex({
  client: "mysql2",
  connection: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "123456",
    database: process.env.DB_NAME || "social_app",
    ssl: getDatabaseSslConfig(),
  },
  pool: { min: 2, max: 10 },
});

export default db;
