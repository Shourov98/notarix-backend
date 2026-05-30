import mongoose from "mongoose";

const emailJobSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    to: { type: String, required: true, lowercase: true, index: true },
    subject: { type: String, required: true },
    html: { type: String, default: "" },
    text: { type: String, default: "" },
    category: { type: String, default: "transactional" },
    status: { type: String, default: "queued" },
  },
  {
    timestamps: true,
  }
);

export const EmailJobModel =
  mongoose.models.EmailJob || mongoose.model("EmailJob", emailJobSchema);
