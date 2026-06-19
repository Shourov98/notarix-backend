import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    provider: { type: String, default: "local" },
    file: { type: String, required: true },
    url: { type: String, default: null },
    mimeType: { type: String, default: null },
    size: { type: Number, default: null },
    kind: { type: String, enum: ["image", "file"], default: "file" },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const readReceiptSchema = new mongoose.Schema(
  {
    actorId: { type: String, required: true },
    actorType: { type: String, enum: ["admin", "user"], required: true },
    readAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    conversationId: { type: String, required: true, index: true },
    orderId: { type: String, required: true, index: true },
    senderId: { type: String, required: true },
    senderType: { type: String, enum: ["admin", "user"], required: true },
    senderRole: { type: String, required: true },
    senderName: { type: String, required: true },
    body: { type: String, default: "" },
    attachments: { type: [attachmentSchema], default: [] },
    readBy: { type: [readReceiptSchema], default: [] },
  },
  {
    timestamps: true,
  }
);

export const MessageModel =
  mongoose.models.Message || mongoose.model("Message", messageSchema);
