#!/usr/bin/env node
const {
  DEFAULT_BASE_URL,
  DEFAULT_USERS_FILE,
  chooseDifferentUser,
  createComment,
  createInlineImageUpload,
  createPost,
  createReply,
  fetchComments,
  fetchFeed,
  likeComment,
  likePost,
  loginUser,
  parseArgs,
  randomInt,
  randomItem,
  readJson,
  sleep,
  toNumber,
  writeJson,
} = require("./helpers");

const postTemplates = [
  "Shipping another realtime sanity check from the simulator.",
  "Testing notification fan-out with a fresh public post.",
  "Simulated user activity is running with delayed writes.",
  "Another feed update to watch comment pagination in motion.",
  "Posting from the load script to inspect cross-user updates.",
];

const commentTemplates = [
  "Seeing this update live in another session now.",
  "Commenting here to verify the shared store refresh path.",
  "This should show up in notifications and feed state.",
  "Checking how this comment behaves under repeated writes.",
  "Another synthetic comment for realtime verification.",
];

const replyTemplates = [
  "Replying here to verify focused modal behavior.",
  "Nested reply from the simulator to keep the thread moving.",
  "This reply should trigger both notification and socket sync.",
  "Adding depth to the thread for real-world testing.",
];

function printHelp() {
  console.log(`
Continuously simulate multi-user social activity against the live backend.

Options:
  --base-url <url>       API base URL. Default: value from file or ${DEFAULT_BASE_URL}
  --input <path>         Input user file. Default: ${DEFAULT_USERS_FILE}
  --iterations <n>       Number of actions. Use 0 for endless mode. Default: 20
  --delay-ms <n>         Base delay between actions. Default: 2000
  --jitter-ms <n>        Extra random delay per action. Default: 1500
  --public-ratio <n>     Fraction of new posts that should be public. Default: 0.85
  --image-ratio <n>      Fraction of new posts that should include an uploaded image. Default: 0
  --persist-logins       Refresh tokens and write them back before starting
  --help                 Show this message
`);
}

async function refreshLogins(baseUrl, users, filePath, shouldPersist) {
  const refreshedUsers = [];

  for (const entry of users) {
    const result = await loginUser(baseUrl, entry.email, entry.password);
    refreshedUsers.push({
      ...entry,
      token: result.token,
      user: result.user,
    });
  }

  if (shouldPersist) {
    writeJson(filePath, {
      baseUrl,
      updatedAt: new Date().toISOString(),
      users: refreshedUsers,
    });
  }

  return refreshedUsers;
}

async function loadPublicFeed(baseUrl, actor) {
  const feed = await fetchFeed(baseUrl, actor.token, 20);
  return Array.isArray(feed.posts) ? feed.posts : [];
}

async function createPostAction(baseUrl, users, stats, publicRatio, imageRatio) {
  const actor = randomItem(users);
  const visibility = Math.random() < publicRatio ? "public" : "private";
  const content = `${randomItem(postTemplates)} [${stats.totalActions + 1}]`;
  const shouldUploadImage = Math.random() < imageRatio;
  const response = await createPost(baseUrl, actor.token, {
    content,
    visibility,
    image: shouldUploadImage ? createInlineImageUpload() : null,
  });

  stats.posts += 1;
  if (shouldUploadImage) {
    stats.imagePosts += 1;
  }
  console.log(`[post] ${actor.email} -> ${visibility} post #${response.post.id}${shouldUploadImage ? " with image" : ""}`);
}

async function commentAction(baseUrl, users, posts, stats) {
  if (posts.length === 0) {
    await createPostAction(baseUrl, users, stats, 1, 0);
    return;
  }

  const targetPost = randomItem(posts);
  const actor = chooseDifferentUser(users, targetPost.user_id);
  const content = `${randomItem(commentTemplates)} [${stats.totalActions + 1}]`;
  const response = await createComment(baseUrl, actor.token, targetPost.id, content);

  stats.comments += 1;
  console.log(`[comment] ${actor.email} -> post #${targetPost.id}, comment #${response.comment.id}`);
}

async function likePostAction(baseUrl, users, posts, stats) {
  if (posts.length === 0) {
    await createPostAction(baseUrl, users, stats, 1, 0);
    return;
  }

  const targetPost = randomItem(posts);
  const actor = chooseDifferentUser(users, targetPost.user_id);
  const response = await likePost(baseUrl, actor.token, targetPost.id);

  stats.postLikes += 1;
  console.log(`[like-post] ${actor.email} -> post #${targetPost.id} (${response.action})`);
}

async function replyAction(baseUrl, users, posts, stats) {
  if (posts.length === 0) {
    await createPostAction(baseUrl, users, stats, 1, 0);
    return;
  }

  const targetPost = randomItem(posts);
  const actor = chooseDifferentUser(users, targetPost.user_id);
  const page = await fetchComments(baseUrl, actor.token, targetPost.id, 10);
  const comments = Array.isArray(page.comments) ? page.comments : [];

  if (comments.length === 0) {
    await commentAction(baseUrl, users, posts, stats);
    return;
  }

  const parentComment = randomItem(comments);
  const content = `${randomItem(replyTemplates)} [${stats.totalActions + 1}]`;
  const response = await createReply(baseUrl, actor.token, targetPost.id, parentComment.id, content);

  stats.replies += 1;
  console.log(`[reply] ${actor.email} -> post #${targetPost.id}, comment #${parentComment.id}, reply #${response.reply.id}`);
}

async function likeCommentAction(baseUrl, users, posts, stats) {
  if (posts.length === 0) {
    await createPostAction(baseUrl, users, stats, 1, 0);
    return;
  }

  const targetPost = randomItem(posts);
  const actor = chooseDifferentUser(users, targetPost.user_id);
  const page = await fetchComments(baseUrl, actor.token, targetPost.id, 10);
  const comments = Array.isArray(page.comments) ? page.comments : [];

  if (comments.length === 0) {
    await commentAction(baseUrl, users, posts, stats);
    return;
  }

  const targetComment = randomItem(comments);
  const response = await likeComment(baseUrl, actor.token, targetPost.id, targetComment.id);

  stats.commentLikes += 1;
  console.log(`[like-comment] ${actor.email} -> comment #${targetComment.id} on post #${targetPost.id} (${response.action})`);
}

async function runSingleAction(baseUrl, users, stats, publicRatio, imageRatio) {
  const posts = await loadPublicFeed(baseUrl, randomItem(users));
  const actionPool = posts.length === 0
    ? ["post"]
    : ["post", "post", "comment", "comment", "likePost", "likePost", "reply", "likeComment"];

  const actionName = randomItem(actionPool);
  if (actionName === "post") return createPostAction(baseUrl, users, stats, publicRatio, imageRatio);
  if (actionName === "comment") return commentAction(baseUrl, users, posts, stats);
  if (actionName === "likePost") return likePostAction(baseUrl, users, posts, stats);
  if (actionName === "reply") return replyAction(baseUrl, users, posts, stats);
  return likeCommentAction(baseUrl, users, posts, stats);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const inputFile = args.input || DEFAULT_USERS_FILE;
  const input = readJson(inputFile);
  const baseUrl = args["base-url"] || input.baseUrl || DEFAULT_BASE_URL;
  const iterations = toNumber(args.iterations, 20);
  const delayMs = toNumber(args["delay-ms"], 2000);
  const jitterMs = toNumber(args["jitter-ms"], 1500);
  const publicRatio = Number(args["public-ratio"] || 0.85);
  const imageRatio = Number(args["image-ratio"] || 0);
  const persistLogins = Boolean(args["persist-logins"]);

  if (!Array.isArray(input.users) || input.users.length === 0) {
    throw new Error("No users found. Run the register-users script first.");
  }

  const users = await refreshLogins(baseUrl, input.users, inputFile, persistLogins);
  const stats = {
    totalActions: 0,
    posts: 0,
    imagePosts: 0,
    comments: 0,
    replies: 0,
    postLikes: 0,
    commentLikes: 0,
  };

  let stopped = false;
  process.on("SIGINT", () => {
    stopped = true;
    console.log("\nStopping simulation after the current action...");
  });

  while (!stopped && (iterations === 0 || stats.totalActions < iterations)) {
    try {
      await runSingleAction(baseUrl, users, stats, publicRatio, imageRatio);
      stats.totalActions += 1;
    } catch (error) {
      console.error(`[error] ${error.message || error}`);
    }

    if (stopped || (iterations !== 0 && stats.totalActions >= iterations)) {
      break;
    }

    const pause = delayMs + randomInt(Math.max(jitterMs, 1));
    await sleep(pause);
  }

  console.log("Simulation summary:", stats);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});