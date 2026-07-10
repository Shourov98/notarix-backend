import mongoose from "mongoose";

const participantSchema = new mongoose.Schema(
  {
    actorId: { type: String, required: true },
    actorType: { type: String, enum: ["admin", "user"], required: true },
    role: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    // `orderId` is set for order-scoped conversations (admin + client + notary).
    // Direct admin ↔ user chats (no order context) leave it null. The partial
    // unique index declared below enforces "one conversation per order" only
    // when orderId is set.
    orderId: { type: String, default: null, index: true },
    kind: { type: String, enum: ["order", "direct"], default: "order", index: true },
    title: { type: String, required: true },
    participants: { type: [participantSchema], default: [] },
    lastMessageAt: { type: Date, default: null },
    lastMessagePreview: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);

// Ensure a single conversation per order, but allow multiple conversations
// with `orderId: null` (direct admin ↔ user chats).
conversationSchema.index(
  { orderId: 1 },
  { unique: true, partialFilterExpression: { orderId: { $type: "string" } } }
);

export const ConversationModel =
  mongoose.models.Conversation || mongoose.model("Conversation", conversationSchema);
