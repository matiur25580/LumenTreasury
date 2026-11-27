import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate.js";
import { allowRoles, type TenantRequest } from "../middleware/requireOrganization.js";
import { LegalEntity } from "../models/LegalEntity.js";
import { Bank } from "../models/Bank.js";
import { BankAccount } from "../models/BankAccount.js";
import { AuditEvent } from "../models/AuditEvent.js";

export const treasuryMasterDataRouter = Router();
treasuryMasterDataRouter.use(authenticate);

const objectId = z.string().regex(/^[a-f\\d]{24}$/i, "A valid record ID is required");
const codeSchema = z.string().trim().min(2).max(24).regex(/^[a-zA-Z0-9_-]+$/);
const countrySchema = z.string().trim().length(2).regex(/^[a-zA-Z]{2}$/).transform(v => v.toUpperCase());
const currencySchema = z.string().trim().length(3).regex(/^[a-zA-Z]{3}$/).transform(v => v.toUpperCase());
const statusSchema = z.enum(["active", "inactive"]);
const entityCreateSchema = z.object({
  code: codeSchema,
  name: z.string().trim().min(2).max(160),
  countryCode: countrySchema,
  functionalCurrency: currencySchema,
  parentEntityId: objectId.nullable().optional()
});
const entityUpdateSchema = entityCreateSchema.partial().extend({ status: statusSchema.optional() });
const bankCreateSchema = z.object({
  code: z.string().trim().min(2).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().trim().min(2).max(160),
  countryCode: countrySchema,
  swiftBic: z.string().trim().toUpperCase().regex(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/).nullable().optional(),
  routingCode: z.string().trim().min(2).max(40).nullable().optional()
});
const bankUpdateSchema = bankCreateSchema.partial().extend({ status: statusSchema.optional() });
const accountTypes = ["operating", "payroll", "tax", "reserve", "escrow", "other"] as const;
const accountCreateSchema = z.object({
  legalEntityId: objectId,
  bankId: objectId,
  accountReference: z.string().trim().min(2).max(64),
  accountName: z.string().trim().min(2).max(120),
  accountLast4: z.string().regex(/^\\d{4}$/).nullable().optional(),
  accountType: z.enum(accountTypes).default("operating"),
  currency: currencySchema
});
const accountUpdateSchema = accountCreateSchema.partial().extend({ status: z.enum(["active", "inactive", "closed"]).optional() });

function tenant(request: TenantRequest) {
  return request.tenant!.organizationId;
}
function actor(request: TenantRequest) {
  return request.auth!.userId;
}
function pagination(request: import("express").Request) {
  const page = Math.max(1, Number.parseInt(String(request.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(request.query.limit ?? "25"), 10) || 25));
  return { page, limit, skip: (page - 1) * limit };
}
async function writeAudit(request: TenantRequest, action: string, resourceType: string, resourceId: string, metadata: Record<string, unknown> = {}) {
  await AuditEvent.create({
    organizationId: tenant(request),
    actorUserId: actor(request),
    action,
    resourceType,
    resourceId,
    metadata,
    ipAddress: request.ip
  });
}
function invalid(response: import("express").Response, details: unknown) {
  response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Please check the submitted fields", details } });
}

async function parentWouldCreateCycle(organizationId: string, entityId: string, candidateParentId: string): Promise<boolean> {
  let cursor: string | null = candidateParentId;
  const visited = new Set<string>();
  for (let depth = 0; cursor && depth < 100; depth += 1) {
    if (cursor === entityId || visited.has(cursor)) return true;
    visited.add(cursor);
    const parent: any = await LegalEntity.findOne({ _id: cursor, organizationId }).select("parentEntityId").lean();
    cursor = parent?.parentEntityId ? String(parent.parentEntityId) : null;
  }
  return cursor !== null;
}
function notFound(response: import("express").Response, resource: string) {
  response.status(404).json({ error: { code: "RESOURCE_NOT_FOUND", message: `${resource} was not found in this organization` } });
}

// Legal entities
treasuryMasterDataRouter.get("/entities", allowRoles(), async (request, response, next) => {
  try {
    const { page, limit, skip } = pagination(request);
    const filter: Record<string, unknown> = { organizationId: tenant(request as TenantRequest) };
    if (request.query.status === "active" || request.query.status === "inactive") filter.status = request.query.status;
    const [items, total] = await Promise.all([
      LegalEntity.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      LegalEntity.countDocuments(filter)
    ]);
    response.json({ data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
});
treasuryMasterDataRouter.post("/entities", allowRoles("owner", "admin", "treasury_manager"), async (request, response, next) => {
  try {
    const parsed = entityCreateSchema.safeParse(request.body);
    if (!parsed.success) { invalid(response, parsed.error.flatten()); return; }
    const t = tenant(request as TenantRequest);
    if (parsed.data.parentEntityId) {
      const parent = await LegalEntity.exists({ _id: parsed.data.parentEntityId, organizationId: t, status: "active" });
      if (!parent) { response.status(400).json({ error: { code: "INVALID_PARENT", message: "Parent entity must be active and belong to this organization" } }); return; }
    }
    const item = await LegalEntity.create({ ...parsed.data, organizationId: t });
    await writeAudit(request as TenantRequest, "master_data.entity.created", "legal_entity", String(item._id), { code: item.code });
    response.status(201).json({ data: item });
  } catch (error) { next(error); }
});
treasuryMasterDataRouter.patch("/entities/:id", allowRoles("owner", "admin", "treasury_manager"), async (request, response, next) => {
  try {
    if (!objectId.safeParse(request.params.id).success) { invalid(response, { id: "Invalid record ID" }); return; }
    const parsed = entityUpdateSchema.safeParse(request.body);
    if (!parsed.success) { invalid(response, parsed.error.flatten()); return; }
    const t = tenant(request as TenantRequest);
    if (parsed.data.parentEntityId) {
      if (parsed.data.parentEntityId === request.params.id) { response.status(400).json({ error: { code: "INVALID_PARENT", message: "A legal entity cannot be its own parent" } }); return; }
      const parent = await LegalEntity.exists({ _id: parsed.data.parentEntityId, organizationId: t, status: "active" });
      if (!parent) { response.status(400).json({ error: { code: "INVALID_PARENT", message: "Parent entity must be active and belong to this organization" } }); return; }
      if (await parentWouldCreateCycle(t, request.params.id, parsed.data.parentEntityId)) { response.status(400).json({ error: { code: "ENTITY_HIERARCHY_CYCLE", message: "The selected parent would create a circular entity hierarchy" } }); return; }
    }
    const item = await LegalEntity.findOneAndUpdate({ _id: request.params.id, organizationId: t }, { $set: parsed.data }, { new: true, runValidators: true });
    if (!item) { notFound(response, "Legal entity"); return; }
    await writeAudit(request as TenantRequest, "master_data.entity.updated", "legal_entity", String(item._id), { changedFields: Object.keys(parsed.data) });
    response.json({ data: item });
  } catch (error) { next(error); }
});

// Bank registry
treasuryMasterDataRouter.get("/banks", allowRoles(), async (request, response, next) => {
  try {
    const { page, limit, skip } = pagination(request);
    const filter: Record<string, unknown> = { organizationId: tenant(request as TenantRequest) };
    if (request.query.status === "active" || request.query.status === "inactive") filter.status = request.query.status;
    const [items, total] = await Promise.all([
      Bank.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      Bank.countDocuments(filter)
    ]);
    response.json({ data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
});
treasuryMasterDataRouter.post("/banks", allowRoles("owner", "admin", "treasury_manager"), async (request, response, next) => {
  try {
    const parsed = bankCreateSchema.safeParse(request.body);
    if (!parsed.success) { invalid(response, parsed.error.flatten()); return; }
    const item = await Bank.create({ ...parsed.data, organizationId: tenant(request as TenantRequest) });
    await writeAudit(request as TenantRequest, "master_data.bank.created", "bank", String(item._id), { code: item.code });
    response.status(201).json({ data: item });
  } catch (error) { next(error); }
});
treasuryMasterDataRouter.patch("/banks/:id", allowRoles("owner", "admin", "treasury_manager"), async (request, response, next) => {
  try {
    if (!objectId.safeParse(request.params.id).success) { invalid(response, { id: "Invalid record ID" }); return; }
    const parsed = bankUpdateSchema.safeParse(request.body);
    if (!parsed.success) { invalid(response, parsed.error.flatten()); return; }
    const item = await Bank.findOneAndUpdate({ _id: request.params.id, organizationId: tenant(request as TenantRequest) }, { $set: parsed.data }, { new: true, runValidators: true });
    if (!item) { notFound(response, "Bank"); return; }
    await writeAudit(request as TenantRequest, "master_data.bank.updated", "bank", String(item._id), { changedFields: Object.keys(parsed.data) });
    response.json({ data: item });
  } catch (error) { next(error); }
});

// Bank accounts deliberately store only a display reference and optional last four digits, never full account credentials.
treasuryMasterDataRouter.get("/accounts", allowRoles(), async (request, response, next) => {
  try {
    const { page, limit, skip } = pagination(request);
    const filter: Record<string, unknown> = { organizationId: tenant(request as TenantRequest) };
    if (request.query.status && ["active", "inactive", "closed"].includes(String(request.query.status))) filter.status = request.query.status;
    if (request.query.legalEntityId && objectId.safeParse(request.query.legalEntityId).success) filter.legalEntityId = request.query.legalEntityId;
    const [items, total] = await Promise.all([
      BankAccount.find(filter).populate("legalEntityId", "code name countryCode").populate("bankId", "code name countryCode swiftBic").sort({ accountName: 1 }).skip(skip).limit(limit).lean(),
      BankAccount.countDocuments(filter)
    ]);
    response.json({ data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
});
treasuryMasterDataRouter.post("/accounts", allowRoles("owner", "admin", "treasury_manager"), async (request, response, next) => {
  try {
    const parsed = accountCreateSchema.safeParse(request.body);
    if (!parsed.success) { invalid(response, parsed.error.flatten()); return; }
    const t = tenant(request as TenantRequest);
    const [entity, bank] = await Promise.all([
      LegalEntity.exists({ _id: parsed.data.legalEntityId, organizationId: t, status: "active" }),
      Bank.exists({ _id: parsed.data.bankId, organizationId: t, status: "active" })
    ]);
    if (!entity || !bank) { response.status(400).json({ error: { code: "INVALID_ACCOUNT_LINK", message: "Select an active legal entity and bank from this organization" } }); return; }
    const item = await BankAccount.create({ ...parsed.data, organizationId: t });
    await writeAudit(request as TenantRequest, "master_data.bank_account.created", "bank_account", String(item._id), { accountReference: item.accountReference, currency: item.currency });
    response.status(201).json({ data: item });
  } catch (error) { next(error); }
});
treasuryMasterDataRouter.patch("/accounts/:id", allowRoles("owner", "admin", "treasury_manager"), async (request, response, next) => {
  try {
    if (!objectId.safeParse(request.params.id).success) { invalid(response, { id: "Invalid record ID" }); return; }
    const parsed = accountUpdateSchema.safeParse(request.body);
    if (!parsed.success) { invalid(response, parsed.error.flatten()); return; }
    const t = tenant(request as TenantRequest);
    if (parsed.data.legalEntityId) {
      const entity = await LegalEntity.exists({ _id: parsed.data.legalEntityId, organizationId: t, status: "active" });
      if (!entity) { response.status(400).json({ error: { code: "INVALID_ENTITY", message: "Legal entity must be active and belong to this organization" } }); return; }
    }
    if (parsed.data.bankId) {
      const bank = await Bank.exists({ _id: parsed.data.bankId, organizationId: t, status: "active" });
      if (!bank) { response.status(400).json({ error: { code: "INVALID_BANK", message: "Bank must be active and belong to this organization" } }); return; }
    }
    const item = await BankAccount.findOneAndUpdate({ _id: request.params.id, organizationId: t }, { $set: parsed.data }, { new: true, runValidators: true });
    if (!item) { notFound(response, "Bank account"); return; }
    await writeAudit(request as TenantRequest, "master_data.bank_account.updated", "bank_account", String(item._id), { changedFields: Object.keys(parsed.data) });
    response.json({ data: item });
  } catch (error) { next(error); }
});

// Soft-disable records; historical references remain available for audit and transaction history.
treasuryMasterDataRouter.delete("/entities/:id", allowRoles("owner", "admin"), async (request, response, next) => {
  try {
    if (!objectId.safeParse(request.params.id).success) { invalid(response, { id: "Invalid record ID" }); return; }
    const t = tenant(request as TenantRequest);
    const inUse = await BankAccount.exists({ organizationId: t, legalEntityId: request.params.id, status: "active" });
    if (inUse) { response.status(409).json({ error: { code: "ENTITY_HAS_ACTIVE_ACCOUNTS", message: "Deactivate or reassign active bank accounts before deactivating this entity" } }); return; }
    const item = await LegalEntity.findOneAndUpdate({ _id: request.params.id, organizationId: t }, { $set: { status: "inactive" } }, { new: true });
    if (!item) { notFound(response, "Legal entity"); return; }
    await writeAudit(request as TenantRequest, "master_data.entity.deactivated", "legal_entity", String(item._id));
    response.json({ data: item });
  } catch (error) { next(error); }
});
treasuryMasterDataRouter.delete("/banks/:id", allowRoles("owner", "admin"), async (request, response, next) => {
  try {
    if (!objectId.safeParse(request.params.id).success) { invalid(response, { id: "Invalid record ID" }); return; }
    const t = tenant(request as TenantRequest);
    const inUse = await BankAccount.exists({ organizationId: t, bankId: request.params.id, status: "active" });
    if (inUse) { response.status(409).json({ error: { code: "BANK_HAS_ACTIVE_ACCOUNTS", message: "Deactivate or reassign active bank accounts before deactivating this bank" } }); return; }
    const item = await Bank.findOneAndUpdate({ _id: request.params.id, organizationId: t }, { $set: { status: "inactive" } }, { new: true });
    if (!item) { notFound(response, "Bank"); return; }
    await writeAudit(request as TenantRequest, "master_data.bank.deactivated", "bank", String(item._id));
    response.json({ data: item });
  } catch (error) { next(error); }
});
treasuryMasterDataRouter.delete("/accounts/:id", allowRoles("owner", "admin"), async (request, response, next) => {
  try {
    if (!objectId.safeParse(request.params.id).success) { invalid(response, { id: "Invalid record ID" }); return; }
    const t = tenant(request as TenantRequest);
    const item = await BankAccount.findOneAndUpdate({ _id: request.params.id, organizationId: t }, { $set: { status: "inactive" } }, { new: true });
    if (!item) { notFound(response, "Bank account"); return; }
    await writeAudit(request as TenantRequest, "master_data.bank_account.deactivated", "bank_account", String(item._id));
    response.json({ data: item });
  } catch (error) { next(error); }
});
