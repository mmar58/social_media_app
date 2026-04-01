import db from "../db";

type RawPost = Record<string, any>;

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

  const comments = await db("comments")
    .select("comments.*", "users.first_name", "users.last_name", "users.profile_picture")
    .join("users", "comments.user_id", "users.id")
    .whereIn("comments.post_id", postIds)
    .orderBy("comments.created_at", "asc");

  const commentIds = comments.map((comment: any) => comment.id);
  const commentLikeRows = commentIds.length
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
      comments: buildCommentTree(postComments),
    };
  });
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

  const [post] = await hydratePosts([rawPost], viewerId);
  return post;
}