import request from "supertest";
import fs from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/db", async () => {
  const module = await import("./utils/mockDb");
  return { default: module.default };
});

import { createApp } from "../src/app";
import { resetMockDb } from "./utils/mockDb";

process.env.JWT_SECRET = "test-secret";

describe("uploads and validation", () => {
  beforeEach(() => {
    resetMockDb();
  });

  function getAuthCookie(response: request.Response) {
    const cookieHeader = response.headers["set-cookie"]?.find((value) => value.startsWith("token="));
    expect(cookieHeader).toBeTruthy();
    return cookieHeader!.split(";")[0];
  }

  async function registerUser(payload: { first_name: string; last_name: string; email: string; password: string }) {
    const { app } = createApp();
    const response = await request(app).post("/api/auth/register").send(payload);
    expect(response.status).toBe(200);
    return {
      user: response.body.user as { id: number; email: string },
      cookie: getAuthCookie(response),
    };
  }

  it("rejects non-image uploads", async () => {
    const { app } = createApp();
    const alice = await registerUser({ first_name: "Alice", last_name: "Adams", email: "a@example.com", password: "password1" });

    const tmpPath = path.join(__dirname, "tmp-upload.txt");
    fs.writeFileSync(tmpPath, "not-an-image");

    const res = await request(app)
      .post("/api/posts")
      .set("Cookie", alice.cookie)
      .attach("image", tmpPath, { filename: "file.txt", contentType: "text/plain" })
      .field("content", "test")
      .field("visibility", "public");

    fs.unlinkSync(tmpPath);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Only jpeg|images are allowed/i);
  });

  it("rejects files larger than 5MB", async () => {
    const { app } = createApp();
    const alice = await registerUser({ first_name: "Alice", last_name: "Adams", email: "b@example.com", password: "password1" });

    const tmpPath = path.join(__dirname, "tmp-big.jpg");
    const bigBuf = Buffer.alloc(6 * 1024 * 1024, 0);
    fs.writeFileSync(tmpPath, bigBuf);

    const res = await request(app)
      .post("/api/posts")
      .set("Cookie", alice.cookie)
      .attach("image", tmpPath, { filename: "big.jpg", contentType: "image/jpeg" })
      .field("content", "big file")
      .field("visibility", "public");

    fs.unlinkSync(tmpPath);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/5MB|smaller/i);
  });
});
