import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, default: null },
    role: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    passwordResetRequired: { type: Boolean, default: false },
    status: { type: String, default: "Active" },
    authProvider: { type: String, default: "local" },
  },
  {
    timestamps: true,
  }
);

export const UserModel =
  mongoose.models.User || mongoose.model("User", userSchema);
