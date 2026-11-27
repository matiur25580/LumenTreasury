import type { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest } from "./authenticate.js";
import { Membership } from "../models/Membership.js";
import { Organization } from "../models/Organization.js";

export interface TenantRequest extends AuthenticatedRequest {
  tenant?: { organizationId: string; role: string };
}
export function allowRoles(...roles: string[]) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const authRequest = request as TenantRequest;
    if (!authRequest.auth) {
      response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } });
      return;
    }
    try {
    const organizationId = request.header("x-organization-id");
    if (!organizationId) {
      response.status(400).json({ error: { code: "ORGANIZATION_REQUIRED", message: "X-Organization-Id header is required" } });
      return;
    }
    const membership: any = await Membership.findOne({ userId: authRequest.auth.userId, organizationId, status: "active" }).lean();
    if (!membership) {
      response.status(403).json({ error: { code: "TENANT_ACCESS_DENIED", message: "You are not an active member of this organization" } });
      return;
    }
    const organization: any = await Organization.findOne({ _id: organizationId, status: "active" }).select("_id").lean();
    if (!organization) {
      response.status(404).json({ error: { code: "ORGANIZATION_NOT_FOUND", message: "Organization not found" } });
      return;
    }
    if (roles.length && !roles.includes(membership.role)) {
      response.status(403).json({ error: { code: "INSUFFICIENT_ROLE", message: "Your role cannot perform this action" } });
      return;
    }
    authRequest.tenant = { organizationId: String(organization._id), role: membership.role };
    next();
    } catch (error) { next(error); }
  };
}
