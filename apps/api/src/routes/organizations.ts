import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate.js";
import { allowRoles, type TenantRequest } from "../middleware/requireOrganization.js";
import { Organization } from "../models/Organization.js";
import { Membership } from "../models/Membership.js";
import { AuditEvent } from "../models/AuditEvent.js";

export const organizationRouter = Router();
organizationRouter.use(authenticate);
organizationRouter.get("/", async (request, response, next) => {
  try {
    const auth = (request as TenantRequest).auth!;
    const memberships = await Membership.find({ userId: auth.userId, status: "active" }).populate("organizationId", "name slug status").lean();
    const data = memberships.filter(m => m.organizationId && typeof m.organizationId === "object" && "status" in m.organizationId && m.organizationId.status === "active").map(m => {
      const org = m.organizationId as unknown as { _id: { toString(): string }; name: string; slug: string };
      return { id: org._id.toString(), name: org.name, slug: org.slug, role: m.role };
    });
    response.json({ data });
  } catch (error) { next(error); }
});
organizationRouter.get("/current", allowRoles(), async (request, response, next) => {
  try {
    const tenant = (request as TenantRequest).tenant!;
    const organization = await Organization.findById(tenant.organizationId).select("_id name slug status createdAt").lean();
    response.json({ data: { ...organization, role: tenant.role } });
  } catch (error) { next(error); }
});
const updateSchema = z.object({ name: z.string().trim().min(2).max(160) });
organizationRouter.patch("/current", allowRoles("owner", "admin"), async (request, response, next) => {
  try {
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Organization name must be 2–160 characters" } }); return; }
    const tenant = (request as TenantRequest).tenant!;
    const organization = await Organization.findByIdAndUpdate(tenant.organizationId, { $set: { name: parsed.data.name } }, { new: true, runValidators: true }).select("_id name slug status");
    await AuditEvent.create({ organizationId: tenant.organizationId, actorUserId: (request as TenantRequest).auth!.userId, action: "organization.updated", resourceType: "organization", resourceId: tenant.organizationId, metadata: { changedFields: ["name"] }, ipAddress: request.ip });
    response.json({ data: organization });
  } catch (error) { next(error); }
});
