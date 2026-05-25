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
    bankInfoEncrypted: { type: String, default: null },
    bankInfoMasked: {
      bankName: { type: String, default: null },
      accountHolderName: { type: String, default: null },
      accountType: { type: String, default: null },
      routingNumber: { type: String, default: null },
      accountNumber: { type: String, default: null },
    },
    bankInfoUpdatedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

export const UserModel =
  mongoose.models.User || mongoose.model("User", userSchema);
