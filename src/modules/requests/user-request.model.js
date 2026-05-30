import mongoose from "mongoose";

const userRequestSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, index: true },
    phone: { type: String, default: "" },
    companyName: { type: String, default: "" },
    contactType: { type: String, required: true },
    requestType: { type: String, required: true },
    state: { type: String, default: "" },
    message: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    rejectionReason: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);

export const UserRequestModel =
  mongoose.models.UserRequest || mongoose.model("UserRequest", userRequestSchema);
