import mongoose, { Schema } from "mongoose";

const legalEntitySchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  parentEntityId: { type: Schema.Types.ObjectId, ref: "LegalEntity", default: null },
  code: { type: String, required: true, trim: true, uppercase: true, maxlength: 24 },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  countryCode: { type: String, required: true, uppercase: true, minlength: 2, maxlength: 2 },
  functionalCurrency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
  status: { type: String, enum: ["active", "inactive"], default: "active", index: true }
}, { timestamps: true, versionKey: false });
legalEntitySchema.index({ organizationId: 1, code: 1 }, { unique: true });
legalEntitySchema.index({ organizationId: 1, parentEntityId: 1 });
export const LegalEntity: mongoose.Model<any> = (mongoose.models.LegalEntity as mongoose.Model<any> | undefined) || mongoose.model<any>("LegalEntity", legalEntitySchema);
