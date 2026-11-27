import mongoose, { Schema } from "mongoose";

const organizationSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  status: { type: String, enum: ["active", "suspended"], default: "active", index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true, versionKey: false });
export const Organization = (mongoose.models.Organization as mongoose.Model<any> | undefined) ?? mongoose.model<any>("Organization", organizationSchema);
