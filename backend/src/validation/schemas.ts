import { z } from "zod";

const positiveIntString = z
  .string()
  .regex(/^\d+$/, "Route parameter must be a positive integer");

export const registerSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(80, "First name is too long"),
  last_name: z.string().trim().min(1, "Last name is required").max(80, "Last name is too long"),
  email: z.email("Email address is invalid").max(255, "Email address is too long"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password is too long"),
});

export const loginSchema = z.object({
  email: z.email("Email address is invalid"),
  password: z.string().min(1, "Password is required").max(128, "Password is too long"),
});

export const feedQuerySchema = z.object({
  search: z.string().trim().max(120, "Search query is too long").optional().default(""),
  limit: z.coerce.number().int().min(1, "Limit must be at least 1").max(50, "Limit cannot exceed 50").optional().default(20),
  cursor: z.coerce.number().int().positive("Cursor must be a positive integer").optional(),
});

export const createPostSchema = z.object({
  content: z.string().trim().max(2000, "Post content cannot exceed 2000 characters").optional().default(""),
  visibility: z.enum(["public", "private"]).optional().default("public"),
});

export const commentPayloadSchema = z.object({
  content: z.string().trim().min(1, "Comment content is required").max(1000, "Comment content cannot exceed 1000 characters"),
});

export const postIdParamsSchema = z.object({
  id: positiveIntString,
});

export const commentParamsSchema = z.object({
  id: positiveIntString,
  commentId: positiveIntString,
});

export const replyParamsSchema = commentParamsSchema;

export const notificationIdParamsSchema = z.object({
  id: positiveIntString,
});