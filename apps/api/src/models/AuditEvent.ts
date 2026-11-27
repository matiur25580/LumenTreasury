import mongoose, { Schema } from "mongoose";

const auditEventSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", default: null, index: true },
  actorUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  action: { type: String, required: true, maxlength: 120 },
  resourceType: { type: String, required: true, maxlength: 120 },
  resourceId: { type: String, default: null, maxlength: 120 },
  metadata: { type: Schema.Types.Mixed, default: {} },
  ipAddress: { type: String, maxlength: 80 }
}, { timestamps: true, versionKey: false, strict: true });
auditEventSchema.index({ organizationId: 1, createdAt: -1 });
export const AuditEvent = mongoose.models.AuditEvent ?? mongoose.model("AuditEvent", auditEventSchema);
