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
    orderId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    participants: { type: [participantSchema], default: [] },
    lastMessageAt: { type: Date, default: null },
    lastMessagePreview: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);

export const ConversationModel =
  mongoose.models.Conversation || mongoose.model("Conversation", conversationSchema);
