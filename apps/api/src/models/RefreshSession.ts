import mongoose, { Schema } from "mongoose";

const refreshSessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  revokedAt: { type: Date, default: null },
  replacedByHash: { type: String, default: null },
  userAgent: { type: String, maxlength: 500 },
  ipAddress: { type: String, maxlength: 80 }
}, { timestamps: true, versionKey: false });
export const RefreshSession = (mongoose.models.RefreshSession as mongoose.Model<any> | undefined) ?? mongoose.model<any>("RefreshSession", refreshSessionSchema);
