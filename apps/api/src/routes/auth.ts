import { randomBytes, createHash } from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { Organization } from "../models/Organization.js";
import { Membership } from "../models/Membership.js";
import { RefreshSession } from "../models/RefreshSession.js";
import { AuditEvent } from "../models/AuditEvent.js";
import { authenticate, type AuthenticatedRequest } from "../middleware/authenticate.js";

export const authRouter = Router();
const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
  organizationName: z.string().trim().min(2).max(160)
});
const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(128) });
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
function issueAccessToken(user: { id: string; email: string }) {
  return jwt.sign({ email: user.email, typ: "access" }, env.JWT_ACCESS_SECRET, { subject: user.id, expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"], issuer: "lumentreasury", audience: "lumentreasury-api" });
}
function setRefreshCookie(response: import("express").Response, token: string) {
  response.cookie("lt_refresh", token, { httpOnly: true, secure: env.COOKIE_SECURE === "true", sameSite: "strict", path: "/api/v1/auth", maxAge: env.REFRESH_TOKEN_DAYS * 86400000 });
}
async function createRefreshSession(userId: string, request: import("express").Request) {
  const token = randomBytes(48).toString("base64url");
  await RefreshSession.create({ userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 86400000), userAgent: request.get("user-agent")?.slice(0, 500), ipAddress: request.ip });
  return token;
}
async function audit(action: string, userId: string, request: import("express").Request, organizationId?: string) {
  await AuditEvent.create({ action, resourceType: "identity", actorUserId: userId, organizationId: organizationId ?? null, ipAddress: request.ip });
}

authRouter.post("/register", async (request, response, next) => {
  try {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid registration details", details: parsed.error.flatten() } }); return; }
    const email = parsed.data.email.toLowerCase();
    if (await User.exists({ email })) { response.status(409).json({ error: { code: "EMAIL_IN_USE", message: "An account with this email already exists" } }); return; }
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await User.create({ email, passwordHash, fullName: parsed.data.fullName });
    const baseSlug = slugify(parsed.data.organizationName) || "organization";
    let slug = baseSlug, suffix = 1;
    while (await Organization.exists({ slug })) { slug = `${baseSlug}-${suffix++}`; }
    const organization = await Organization.create({ name: parsed.data.organizationName, slug, createdBy: user._id });
    await Membership.create({ userId: user._id, organizationId: organization._id, role: "owner", status: "active" });
    const refresh = await createRefreshSession(String(user._id), request);
    setRefreshCookie(response, refresh);
    await audit("auth.register", String(user._id), request, String(organization._id));
    response.status(201).json({ data: { accessToken: issueAccessToken({ id: String(user._id), email }), tokenType: "Bearer", expiresIn: env.ACCESS_TOKEN_TTL, user: { id: String(user._id), email, fullName: user.fullName }, organizations: [{ id: String(organization._id), name: organization.name, slug: organization.slug, role: "owner" }] } });
  } catch (error) { next(error); }
});

authRouter.post("/login", async (request, response, next) => {
  try {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Email and password are required" } }); return; }
    const user = await User.findOne({ email: parsed.data.email.toLowerCase() }).select("+passwordHash");
    if (!user || user.status !== "active" || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) { response.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect" } }); return; }
    user.lastLoginAt = new Date(); await user.save();
    const memberships = await Membership.find({ userId: user._id, status: "active" }).populate("organizationId", "name slug status").lean();
    const organizations = memberships.filter(m => m.organizationId && typeof m.organizationId === "object" && "status" in m.organizationId && m.organizationId.status === "active").map(m => {
      const org = m.organizationId as unknown as { _id: { toString(): string }; name: string; slug: string };
      return { id: org._id.toString(), name: org.name, slug: org.slug, role: m.role };
    });
    const refresh = await createRefreshSession(String(user._id), request); setRefreshCookie(response, refresh);
    await audit("auth.login", String(user._id), request);
    response.json({ data: { accessToken: issueAccessToken({ id: String(user._id), email: user.email }), tokenType: "Bearer", expiresIn: env.ACCESS_TOKEN_TTL, user: { id: String(user._id), email: user.email, fullName: user.fullName }, organizations } });
  } catch (error) { next(error); }
});

authRouter.post("/refresh", async (request, response, next) => {
  try {
    const token = request.cookies?.lt_refresh as string | undefined;
    if (!token) { response.status(401).json({ error: { code: "REFRESH_REQUIRED", message: "Refresh session is required" } }); return; }
    const oldHash = hashToken(token);
    const session = await RefreshSession.findOneAndUpdate({ tokenHash: oldHash, revokedAt: null, expiresAt: { $gt: new Date() } }, { $set: { revokedAt: new Date() } }, { new: false });
    if (!session) { response.clearCookie("lt_refresh", { path: "/api/v1/auth" }); response.status(401).json({ error: { code: "REFRESH_INVALID", message: "Refresh session is invalid or expired" } }); return; }
    const user = await User.findOne({ _id: session.userId, status: "active" });
    if (!user) { response.clearCookie("lt_refresh", { path: "/api/v1/auth" }); response.status(401).json({ error: { code: "ACCOUNT_INACTIVE", message: "Account is unavailable" } }); return; }
    const nextToken = await createRefreshSession(String(user._id), request);
    session.replacedByHash = hashToken(nextToken); await session.save();
    setRefreshCookie(response, nextToken);
    response.json({ data: { accessToken: issueAccessToken({ id: String(user._id), email: user.email }), tokenType: "Bearer", expiresIn: env.ACCESS_TOKEN_TTL } });
  } catch (error) { next(error); }
});

authRouter.post("/logout", async (request, response, next) => {
  try {
    const token = request.cookies?.lt_refresh as string | undefined;
    if (token) await RefreshSession.updateOne({ tokenHash: hashToken(token), revokedAt: null }, { $set: { revokedAt: new Date() } });
    response.clearCookie("lt_refresh", { path: "/api/v1/auth" });
    response.status(204).send();
  } catch (error) { next(error); }
});

authRouter.get("/me", authenticate, async (request, response, next) => {
  try {
    const auth = (request as AuthenticatedRequest).auth!;
    const user = await User.findById(auth.userId).select("_id email fullName status createdAt").lean();
    const memberships = await Membership.find({ userId: auth.userId, status: "active" }).populate("organizationId", "name slug status").lean();
    const organizations = memberships.filter(m => m.organizationId && typeof m.organizationId === "object" && "status" in m.organizationId && m.organizationId.status === "active").map(m => {
      const org = m.organizationId as unknown as { _id: { toString(): string }; name: string; slug: string };
      return { id: org._id.toString(), name: org.name, slug: org.slug, role: m.role };
    });
    response.json({ data: { user, organizations } });
  } catch (error) { next(error); }
});
