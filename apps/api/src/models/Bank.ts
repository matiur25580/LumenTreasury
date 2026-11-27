import mongoose, { Schema } from "mongoose";

const bankSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  code: { type: String, required: true, trim: true, uppercase: true, maxlength: 32 },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  countryCode: { type: String, required: true, uppercase: true, minlength: 2, maxlength: 2 },
  swiftBic: { type: String, trim: true, uppercase: true, maxlength: 11, default: null },
  routingCode: { type: String, trim: true, maxlength: 40, default: null },
  status: { type: String, enum: ["active", "inactive"], default: "active", index: true }
}, { timestamps: true, versionKey: false });
bankSchema.index({ organizationId: 1, code: 1 }, { unique: true });
bankSchema.index({ organizationId: 1, name: 1 });
export const Bank: mongoose.Model<any> = (mongoose.models.Bank as mongoose.Model<any> | undefined) || mongoose.model<any>("Bank", bankSchema);
