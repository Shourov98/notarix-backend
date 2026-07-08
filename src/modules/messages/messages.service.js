import crypto from "node:crypto";
import { ConversationModel } from "./conversation.model.js";
import { MessageModel } from "./message.model.js";
import { normalizeCloudinaryUrl } from "../../shared/storage/cloudinary.js";

const toParticipant = (actor) => ({
  actorId: actor.id,
  actorType: actor.type,
  role: actor.role,
  name: actor.record?.name || actor.record?.primaryContact?.name || actor.id,
  email: actor.record?.email || "",
});

export const ensureOrderConversation = async ({ order, admin, client, notary }) => {
  const participants = [admin, client, notary]
    .filter(Boolean)
    .map(toParticipant);

  const title = `${order.clientCompany || order.clientName} · ${order.signerName}`;

  const existing = await ConversationModel.findOne({ orderId: order.id }).lean();

  if (!existing) {
    const conversation = {
      id: `conv-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      orderId: order.id,
      title,
      participants,
      lastMessageAt: null,
      lastMessagePreview: "",
    };

    await ConversationModel.create(conversation);
    return conversation;
  }

  const nextParticipants = [...participants];
  await ConversationModel.updateOne(
    { orderId: order.id },
    {
      $set: {
        title,
        participants: nextParticipants,
      },
    }
  );

  return ConversationModel.findOne({ orderId: order.id }).lean();
};

export const touchConversationPreview = async ({
  conversationId,
  preview,
  createdAt = new Date(),
}) => {
  await ConversationModel.updateOne(
    { id: conversationId },
    {
      $set: {
        lastMessageAt: createdAt,
        lastMessagePreview: preview,
      },
    }
  );
};

export const serializeConversation = (conversation, actorId) => {
  const counterpart = (conversation.participants || []).find(
    (participant) => participant.actorId !== actorId
  ) || conversation.participants?.[0];

  return {
    id: conversation.id,
    orderId: conversation.orderId,
    title: conversation.title,
    lastMessageAt: conversation.lastMessageAt,
    lastMessagePreview: conversation.lastMessagePreview,
    participants: conversation.participants || [],
    counterpart: counterpart
      ? {
          name: counterpart.name,
          role: counterpart.role,
          email: counterpart.email,
        }
      : null,
  };
};

export const serializeMessage = (message, actorId) => ({
  id: message.id,
  conversationId: message.conversationId,
  orderId: message.orderId,
  senderId: message.senderId,
  senderRole: message.senderRole,
  senderName: message.senderName,
  body: message.body || "",
  attachments: (message.attachments || []).map((attachment) => {
    const isHostedOnCloudinary = typeof attachment.url === "string" && attachment.url.startsWith("http");
    const cloudinaryUrl = isHostedOnCloudinary ? normalizeCloudinaryUrl(attachment.url, attachment.mimeType) : null;
    const fallbackView = attachment.file
      ? `/api/v1/files/conversations/${message.conversationId}/attachments/${attachment.id}?mode=view`
      : null;
    const fallbackDownload = attachment.file
      ? `/api/v1/files/conversations/${message.conversationId}/attachments/${attachment.id}?mode=download`
      : null;

    return {
      id: attachment.id,
      name: attachment.name,
      url: isHostedOnCloudinary ? cloudinaryUrl : fallbackView,
      downloadUrl: isHostedOnCloudinary ? cloudinaryUrl : fallbackDownload,
      mimeType: attachment.mimeType || null,
      size: attachment.size || null,
      kind: attachment.kind || "file",
      uploadedAt: attachment.uploadedAt || null,
    };
  }),
  createdAt: message.createdAt,
  isOwnMessage: message.senderId === actorId,
  isRead: (message.readBy || []).some((entry) => entry.actorId === actorId),
  readBy: message.readBy || [],
});

export const buildMessageRecord = ({
  conversation,
  actor,
  body = "",
  attachments = [],
}) => ({
  id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
  conversationId: conversation.id,
  orderId: conversation.orderId,
  senderId: actor.id,
  senderType: actor.type,
  senderRole: actor.role,
  senderName: actor.record?.name || actor.record?.primaryContact?.name || actor.id,
  body,
  attachments,
  readBy: [
    {
      actorId: actor.id,
      actorType: actor.type,
      readAt: new Date(),
    },
  ],
});

export const createMessage = async ({ conversation, actor, body = "", attachments = [] }) => {
  const message = buildMessageRecord({
    conversation,
    actor,
    body,
    attachments,
  });

  await MessageModel.create(message);
  await touchConversationPreview({
    conversationId: conversation.id,
    preview: body || (attachments[0]?.name ? `Attachment: ${attachments[0].name}` : "New message"),
    createdAt: new Date(),
  });

  return MessageModel.findOne({ id: message.id }).lean();
};
