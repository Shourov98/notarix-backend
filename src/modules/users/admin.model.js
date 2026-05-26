import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, default: null },
    role: {
      type: String,
      enum: ["admin", "super_admin"],
      default: "admin",
    },
    permissions: { type: [String], default: [] },
    isVerified: { type: Boolean, default: false },
    passwordResetRequired: { type: Boolean, default: false },
    phone: { type: String, default: null },
    avatar: { type: String, default: "/profile.jpg" },
    status: { type: String, default: "Active" },
    forgotOtp: { type: String, default: null },
    forgotOtpVerified: { type: Boolean, default: false },
    refreshToken: { type: String, default: null },
    lastSignInAt: { type: Date, default: null },
    createdBy: { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

export const AdminModel =
  mongoose.models.Admin || mongoose.model("Admin", adminSchema);
