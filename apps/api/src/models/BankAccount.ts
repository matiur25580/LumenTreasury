import mongoose, { Schema } from "mongoose";

const bankAccountSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  legalEntityId: { type: Schema.Types.ObjectId, ref: "LegalEntity", required: true, index: true },
  bankId: { type: Schema.Types.ObjectId, ref: "Bank", required: true, index: true },
  accountReference: { type: String, required: true, trim: true, maxlength: 64 },
  accountName: { type: String, required: true, trim: true, maxlength: 120 },
  accountLast4: { type: String, match: /^\\d{4}$/, default: null },
  accountType: { type: String, enum: ["operating", "payroll", "tax", "reserve", "escrow", "other"], default: "operating" },
  currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
  status: { type: String, enum: ["active", "inactive", "closed"], default: "active", index: true }
}, { timestamps: true, versionKey: false });
bankAccountSchema.index({ organizationId: 1, accountReference: 1 }, { unique: true });
bankAccountSchema.index({ organizationId: 1, legalEntityId: 1, status: 1 });
export const BankAccount: mongoose.Model<any> = (mongoose.models.BankAccount as mongoose.Model<any> | undefined) || mongoose.model<any>("BankAccount", bankAccountSchema);
