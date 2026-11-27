import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";

export interface AuthenticatedRequest extends Request {
  auth?: { userId: string; email: string };
}
export async function authenticate(request: Request, response: Response, next: NextFunction) {
  const header = request.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    if (payload.typ !== "access" || typeof payload.sub !== "string" || typeof payload.email !== "string") throw new Error("Invalid token");
    const user = await User.findById(payload.sub).select("_id email status");
    if (!user || user.status !== "active") throw new Error("Inactive user");
    (request as AuthenticatedRequest).auth = { userId: String(user._id), email: user.email };
    next();
  } catch {
    response.status(401).json({ error: { code: "INVALID_TOKEN", message: "Access token is invalid or expired" } });
  }
}
