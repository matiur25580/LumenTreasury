import mongoose, { Schema } from "mongoose";

const userSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  status: { type: String, enum: ["active", "suspended"], default: "active", index: true },
  emailVerifiedAt: { type: Date, default: null },
  lastLoginAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });
export const User: mongoose.Model<any> = (mongoose.models.User as mongoose.Model<any> | undefined) || mongoose.model<any>("User", userSchema);
