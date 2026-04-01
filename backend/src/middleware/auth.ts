import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: any;
}

function parseCookie(req: Request, name: string) {
  const cookie = req.headers.cookie;
  if (!cookie) return null;
  const parts = cookie.split(";").map((c) => c.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.split("=").slice(1).join("="));
  }
  return null;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  let token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    token = parseCookie(req, "token") || undefined;
  }

  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    req.user = decoded;
    next();
  } catch (ex) {
    res.status(401).json({ message: "Invalid token" });
  }
};
