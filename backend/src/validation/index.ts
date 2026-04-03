import { NextFunction, Request, Response } from "express";
import { z, ZodTypeAny } from "zod";

function formatError(error: z.ZodError) {
  return error.issues[0]?.message || "Invalid request";
}

function validatePart(schema: ZodTypeAny, key: "body" | "query" | "params") {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[key]);
    if (!result.success) {
      // Log validation failures to help debugging client 400s
      try {
        console.warn(`[validation] ${req.method} ${req.originalUrl} - ${formatError(result.error)}`);
      } catch (e) {
        // ignore logging errors
      }

      return res.status(400).json({ error: formatError(result.error) });
    }

    req[key] = result.data;
    return next();
  };
}

export const validateBody = (schema: ZodTypeAny) => validatePart(schema, "body");
export const validateQuery = (schema: ZodTypeAny) => validatePart(schema, "query");
export const validateParams = (schema: ZodTypeAny) => validatePart(schema, "params");