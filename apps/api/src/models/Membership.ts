import mongoose, { Schema } from "mongoose";

const membershipSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  role: { type: String, enum: ["owner", "admin", "treasury_manager", "analyst", "viewer"], default: "owner" },
  status: { type: String, enum: ["active", "invited", "suspended"], default: "active", index: true }
}, { timestamps: true, versionKey: false });
membershipSchema.index({ userId: 1, organizationId: 1 }, { unique: true });
export const Membership = (mongoose.models.Membership as mongoose.Model<any> | undefined) ?? mongoose.model<any>("Membership", membershipSchema);
