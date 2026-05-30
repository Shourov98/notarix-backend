import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    meta: { type: String, default: "" },
    action: { type: String, default: "" },
    audience: { type: String, default: "admin" },
    recipientId: { type: String, default: null, index: true },
    recipientType: { type: String, default: null },
    entityType: { type: String, default: null },
    entityId: { type: String, default: null },
    read: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

export const NotificationModel =
  mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
