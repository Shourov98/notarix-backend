import mongoose from "mongoose";

const requiredDocumentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, index: true },
    title: { type: String, required: true },
    status: {
      type: String,
      enum: ["Missing", "Pending", "Verified", "Rejected"],
      default: "Missing",
    },
    file: { type: String, default: null },
    mimeType: { type: String, default: null },
    size: { type: Number, default: null },
  },
  { _id: false }
);

const maskedBankInfoSchema = new mongoose.Schema(
  {
    bankName: { type: String, default: null },
    accountHolderName: { type: String, default: null },
    accountType: { type: String, default: null },
    routingNumber: { type: String, default: null },
    accountNumber: { type: String, default: null },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, default: null },
    refreshToken: { type: String, default: null },
    lastSignInAt: { type: Date, default: null },
    role: {
      type: String,
      required: true,
      enum: ["Client", "Notary"],
    },
    isVerified: { type: Boolean, default: false },
    passwordResetRequired: { type: Boolean, default: false },
    status: { type: String, default: "Active" },
    verification: { type: String, default: "Pending" },
    authProvider: { type: String, default: "local" },
    company: { type: String, default: "" },
    area: { type: String, default: "" },
    avatarTone: { type: String, default: "" },
    organization: { type: mongoose.Schema.Types.Mixed, default: {} },
    address: { type: mongoose.Schema.Types.Mixed, default: {} },
    primaryContact: { type: mongoose.Schema.Types.Mixed, default: {} },
    secondaryContact: { type: mongoose.Schema.Types.Mixed, default: {} },
    personalInfo: { type: mongoose.Schema.Types.Mixed, default: {} },
    commission: { type: mongoose.Schema.Types.Mixed, default: {} },
    specialties: { type: [String], default: [] },
    ronEligible: { type: Boolean, default: false },
    requiredDocuments: { type: [requiredDocumentSchema], default: [] },
    bankInfoEncrypted: { type: String, default: null },
    bankInfoMasked: { type: maskedBankInfoSchema, default: () => ({}) },
    bankInfoUpdatedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

export const UserModel =
  mongoose.models.User || mongoose.model("User", userSchema);
