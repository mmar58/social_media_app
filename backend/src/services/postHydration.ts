import db from "../db";

type RawPost = Record<string, any>;

interface HydratePostsOptions {
  includeComments?: boolean;
}

interface CommentPageOptions {
  cursor?: number | null;
  limit?: number;
}

function buildCommentTree(comments: any[]) {
  const topLevelComments = comments.filter((comment) => comment.parent_id === null);
  const replies = comments.filter((comment) => comment.parent_id !== null);
  const commentsById = new Map(topLevelComments.map((comment) => [comment.id, comment]));

  for (const reply of replies) {
    const parent = commentsById.get(reply.parent_id);
    if (parent) {
      parent.replies.push(reply);
    }
  }

  return topLevelComments;
}

export async function hydratePosts(rawPosts: RawPost[], viewerId: number) {
  return hydratePostsWithOptions(rawPosts, viewerId, { includeComments: true });
}

async function hydratePostsWithOptions(rawPosts: RawPost[], viewerId: number, options: HydratePostsOptions) {
  if (!rawPosts.length) {
    return [];
  }

  const postIds = rawPosts.map((post) => post.id);
  const postLikeRows = await db("likes")
    .select("likes.*", "users.first_name", "users.last_name", "users.profile_picture")
    .join("users", "likes.user_id", "users.id")
    .where("likes.target_type", "post")
    .whereIn("likes.target_id", postIds)
    .orderBy("likes.created_at", "desc");

  const commentCountRows = await db("comments")
    .select("comments.id", "comments.post_id")
    .whereIn("comments.post_id", postIds);

  const comments = options.includeComments
    ? await db("comments")
        .select("comments.*", "users.first_name", "users.last_name", "users.profile_picture")
        .join("users", "comments.user_id", "users.id")
        .whereIn("comments.post_id", postIds)
        .orderBy("comments.created_at", "asc")
    : [];

  const commentIds = comments.map((comment: any) => comment.id);
  const commentLikeRows = options.includeComments && commentIds.length
    ? await db("likes")
        .where("target_type", "comment")
        .whereIn("target_id", commentIds)
    : [];

  const postLikesByPostId = new Map<number, any[]>();
  for (const likeRow of postLikeRows) {
    const likesForPost = postLikesByPostId.get(likeRow.target_id) || [];
    likesForPost.push(likeRow);
    postLikesByPostId.set(likeRow.target_id, likesForPost);
  }

  const commentLikesByCommentId = new Map<number, any[]>();
  for (const likeRow of commentLikeRows) {
    const likesForComment = commentLikesByCommentId.get(likeRow.target_id) || [];
    likesForComment.push(likeRow);
    commentLikesByCommentId.set(likeRow.target_id, likesForComment);
  }

  const commentsByPostId = new Map<number, any[]>();
  for (const comment of comments) {
    const likesForComment = commentLikesByCommentId.get(comment.id) || [];
    const formattedComment = {
      ...comment,
      authorName: `${comment.first_name} ${comment.last_name}`,
      authorProfilePicture: comment.profile_picture,
      likes: likesForComment.length,
      isLiked: likesForComment.some((likeRow: any) => likeRow.user_id === viewerId),
      replies: [],
    };

    const commentsForPost = commentsByPostId.get(comment.post_id) || [];
    commentsForPost.push(formattedComment);
    commentsByPostId.set(comment.post_id, commentsForPost);
  }

  const commentCountsByPostId = new Map<number, number>();
  for (const row of commentCountRows) {
    const currentCount = commentCountsByPostId.get(row.post_id) || 0;
    commentCountsByPostId.set(row.post_id, currentCount + 1);
  }

  return rawPosts.map((post) => {
    const likesForPost = postLikesByPostId.get(post.id) || [];
    const postComments = commentsByPostId.get(post.id) || [];

    return {
      ...post,
      authorName: `${post.first_name} ${post.last_name}`,
      authorProfilePicture: post.profile_picture,
      likes: likesForPost.length,
      isLiked: likesForPost.some((likeRow: any) => likeRow.user_id === viewerId),
      likers: likesForPost.slice(0, 8).map((likeRow: any) => ({
        userId: likeRow.user_id,
        profile_picture: likeRow.profile_picture,
        name: `${likeRow.first_name} ${likeRow.last_name}`,
      })),
      totalComments: commentCountsByPostId.get(post.id) || 0,
      commentsLoaded: options.includeComments,
      commentsNextCursor: null,
      hasMoreComments: false,
      comments: options.includeComments ? buildCommentTree(postComments) : [],
    };
  });
}

export async function hydrateFeedPosts(rawPosts: RawPost[], viewerId: number) {
  return hydratePostsWithOptions(rawPosts, viewerId, { includeComments: false });
}

export async function hydratePostComments(postId: number, viewerId: number, options: CommentPageOptions = {}) {
  const limit = options.limit || 10;
  let topLevelQuery = db("comments")
    .select("comments.*", "users.first_name", "users.last_name", "users.profile_picture")
    .join("users", "comments.user_id", "users.id")
    .where({ "comments.post_id": postId, "comments.parent_id": null })
    .orderBy("comments.id", "desc");

  if (options.cursor) {
    topLevelQuery = topLevelQuery.andWhere("comments.id", "<", options.cursor);
  }

  const topLevelComments = await topLevelQuery.limit(limit + 1);
  const hasMore = topLevelComments.length > limit;
  const pageComments = topLevelComments.slice(0, limit);
  const topLevelIds = pageComments.map((comment: any) => comment.id);

  const replies = topLevelIds.length
    ? await db("comments")
        .select("comments.*", "users.first_name", "users.last_name", "users.profile_picture")
        .join("users", "comments.user_id", "users.id")
        .where("comments.post_id", postId)
        .whereIn("comments.parent_id", topLevelIds)
        .orderBy("comments.created_at", "asc")
    : [];

  const comments = [...pageComments, ...replies];
  const commentIds = comments.map((comment: any) => comment.id);
  const commentLikeRows = commentIds.length
    ? await db("likes")
        .where("target_type", "comment")
        .whereIn("target_id", commentIds)
    : [];

  const commentLikesByCommentId = new Map<number, any[]>();
  for (const likeRow of commentLikeRows) {
    const likesForComment = commentLikesByCommentId.get(likeRow.target_id) || [];
    likesForComment.push(likeRow);
    commentLikesByCommentId.set(likeRow.target_id, likesForComment);
  }

  const formattedComments = comments.map((comment: any) => {
    const likesForComment = commentLikesByCommentId.get(comment.id) || [];
    return {
      ...comment,
      authorName: `${comment.first_name} ${comment.last_name}`,
      authorProfilePicture: comment.profile_picture,
      likes: likesForComment.length,
      isLiked: likesForComment.some((likeRow: any) => likeRow.user_id === viewerId),
      replies: [],
    };
  });

  const totalCommentRows = await db("comments").select("id").where({ post_id: postId });
  const nextCursor = hasMore ? pageComments[pageComments.length - 1]?.id ?? null : null;

  return {
    comments: buildCommentTree(formattedComments),
    nextCursor,
    hasMore,
    totalComments: totalCommentRows.length,
  };
}

export async function hydratePostById(postId: number, viewerId: number) {
  const rawPost = await db("posts")
    .select("posts.*", "users.first_name", "users.last_name", "users.profile_picture")
    .join("users", "posts.user_id", "users.id")
    .where("posts.id", postId)
    .first();

  if (!rawPost) {
    return null;
  }

  const [post] = await hydratePostsWithOptions([rawPost], viewerId, { includeComments: true });
  return post;
}