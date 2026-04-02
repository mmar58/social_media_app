const fs = require("fs");
const path = require("path");

const DEFAULT_BASE_URL = process.env.SOCIAL_APP_API_BASE_URL || "http://localhost:5000";
const DEFAULT_USERS_FILE = path.join(__dirname, "users.generated.json");
const TINY_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnN0i8AAAAASUVORK5CYII=";

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;

    const trimmed = token.slice(2);
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex >= 0) {
      const key = trimmed.slice(0, equalsIndex);
      const value = trimmed.slice(equalsIndex + 1);
      args[key] = value;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[trimmed] = true;
      continue;
    }

    args[trimmed] = next;
    index += 1;
  }

  return args;
}

function toNumber(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeJson(filePath, data) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function requestJson(endpoint, options = {}) {
  const response = await fetch(endpoint, options);
  const text = await response.text();
  const data = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    const message = data?.error || data?.message || response.statusText || "Request failed";
    const error = new Error(`${response.status} ${message}`);
    error.status = response.status;
    error.body = data;
    throw error;
  }

  return data;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function registerUser(baseUrl, payload) {
  return requestJson(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function loginUser(baseUrl, email, password) {
  return requestJson(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

async function apiRequest(baseUrl, token, pathname, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  return requestJson(`${baseUrl}${pathname}`, {
    ...options,
    headers,
  });
}

async function createPost(baseUrl, token, payload) {
  const formData = new FormData();
  formData.set("content", payload.content);
  formData.set("visibility", payload.visibility || "public");
  if (payload.image) {
    formData.set("image", payload.image.blob, payload.image.filename);
  }

  return apiRequest(baseUrl, token, "/api/posts", {
    method: "POST",
    body: formData,
  });
}

function createInlineImageUpload() {
  const buffer = Buffer.from(TINY_PNG_BASE64, "base64");
  const blob = new Blob([buffer], { type: "image/png" });

  return {
    blob,
    filename: `simulated-${Date.now()}.png`,
    mimeType: "image/png",
  };
}

async function createComment(baseUrl, token, postId, content) {
  return apiRequest(baseUrl, token, `/api/posts/${postId}/comment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

async function createReply(baseUrl, token, postId, commentId, content) {
  return apiRequest(baseUrl, token, `/api/posts/${postId}/comments/${commentId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

async function likePost(baseUrl, token, postId) {
  return apiRequest(baseUrl, token, `/api/posts/${postId}/like`, {
    method: "POST",
  });
}

async function likeComment(baseUrl, token, postId, commentId) {
  return apiRequest(baseUrl, token, `/api/posts/${postId}/comments/${commentId}/like`, {
    method: "POST",
  });
}

async function fetchFeed(baseUrl, token, limit = 20) {
  return apiRequest(baseUrl, token, `/api/posts?limit=${limit}`);
}

async function fetchComments(baseUrl, token, postId, limit = 10) {
  return apiRequest(baseUrl, token, `/api/posts/${postId}/comments?limit=${limit}`);
}

function buildGeneratedUser(index, password, emailPrefix, runId) {
  const serial = String(index + 1).padStart(2, "0");
  return {
    first_name: `Load${serial}`,
    last_name: "User",
    email: `${emailPrefix}+${runId}-${serial}@example.com`,
    password,
  };
}

function chooseDifferentUser(users, excludedUserId) {
  const eligible = users.filter((entry) => entry.user?.id !== excludedUserId);
  return eligible.length > 0 ? randomItem(eligible) : randomItem(users);
}

module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_USERS_FILE,
  apiRequest,
  buildGeneratedUser,
  chooseDifferentUser,
  createComment,
  createInlineImageUpload,
  createPost,
  createReply,
  ensureDir,
  fetchComments,
  fetchFeed,
  likeComment,
  likePost,
  loginUser,
  parseArgs,
  randomInt,
  randomItem,
  readJson,
  registerUser,
  sleep,
  toNumber,
  writeJson,
};