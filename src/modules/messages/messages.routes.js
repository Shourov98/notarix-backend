import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import {
  requireAdminAuth,
  requireAuthenticatedActor,
} from "../../shared/http/auth-middleware.js";
import { fail, ok } from "../../shared/http/respond.js";
import { validate } from "../../shared/middleware/validate.js";
import { storeUploadedFile } from "../../shared/storage/cloudinary.js";
import { upload } from "../../shared/storage/upload.js";
import { emitConversationMessage } from "../../shared/realtime/socket.js";
import { ConversationModel } from "./conversation.model.js";
import { MessageModel } from "./message.model.js";
import { UserModel } from "../users/user.model.js";
import {
  createMessage,
  ensureDirectConversation,
  ensureOrderConversation,
  serializeConversation,
  serializeMessage,
} from "./messages.service.js";

export const messagesRouter = Router();

const conversationIdSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().min(1) }),
});

const orderConversationSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({ orderId: z.string().min(1) }),
});

const sendMessageSchema = z.object({
  body: z.object({
    body: z.string().min(1),
  }),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().min(1) }),
});

const messageIdSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().min(1) }),
});

const actorHasConversationAccess = (conversation, actor) =>
  (conversation.participants || []).some(
    (participant) =>
      participant.actorId === actor.id && participant.actorType === actor.type
  );

const requireConversationParticipant = async (conversationId, actor) => {
  const conversation = await ConversationModel.findOne({ id: conversationId }).lean();
  if (!conversation) {
    return { error: ["CONVERSATION_NOT_FOUND", "Conversation not found."] };
  }

  if (!actorHasConversationAccess(conversation, actor)) {
    return { error: ["FORBIDDEN", "You do not have access to this conversation."] };
  }

  return { conversation };
};

const buildAttachmentRecord = (file, stored) => ({
  id: `att-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
  name: file.originalname,
  provider: stored.provider,
  file: stored.file,
  url: stored.url,
  mimeType: stored.mimeType,
  size: stored.size,
  kind: file.mimetype?.startsWith("image/") ? "image" : "file",
  uploadedAt: new Date(),
});

messagesRouter.get(
  "/conversations",
  requireAuthenticatedActor,
  async (req, res) => {
    const conversations = await ConversationModel.find({
      participants: {
        $elemMatch: {
          actorId: req.actor.id,
          actorType: req.actor.type,
        },
      },
    })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .lean();

    return ok(
      res,
      await Promise.all(conversations.map((item) => serializeConversation(item, req.actor.id)))
    );
  }
);

messagesRouter.get(
  "/conversations/order/:orderId",
  requireAuthenticatedActor,
  validate(orderConversationSchema),
  async (req, res) => {
    const { OrderModel } = await import("../orders/order.model.js");

    let conversation = await ConversationModel.findOne({
      orderId: req.params.orderId,
    }).lean();

    // Lazy-create the order conversation if it doesn't exist yet. The first
    // authorized viewer (admin or client) becomes a participant. The notary
    // (if any) is also added as a participant only if already assigned.
    if (!conversation) {
      const order = await OrderModel.findOne({ id: req.params.orderId }).lean();
      if (!order) {
        return fail(res, 404, "ORDER_NOT_FOUND", "Order not found.");
      }

      // Only admin or the order's client can open the conversation before a
      // notary is assigned.
      const isAdmin = req.actor.type === "admin";
      const isOrderClient =
        req.actor.type === "user" &&
        req.actor.role === "Client" &&
        (req.actor.id === order.clientUserId || req.actor.record?.id === order.clientUserId);
      if (!isAdmin && !isOrderClient) {
        return fail(res, 403, "FORBIDDEN", "You do not have access to this conversation.");
      }

      const client = await UserModel.findOne({ id: order.clientUserId }).lean();
      const notary = order.notaryId
        ? await UserModel.findOne({ id: order.notaryId }).lean()
        : null;

      conversation = await ensureOrderConversation({
        order,
        admin: isAdmin
          ? {
              id: req.actor.id,
              type: "admin",
              role: req.actor.role || "Admin",
              record: { id: req.actor.id, name: req.actor.name, email: req.actor.email },
            }
          : null,
        client: client
          ? { id: client.id, type: "user", role: client.role, record: client }
          : null,
        notary: notary
          ? { id: notary.id, type: "user", role: notary.role, record: notary }
          : null,
      });
    }

    if (!actorHasConversationAccess(conversation, req.actor)) {
      return fail(res, 403, "FORBIDDEN", "You do not have access to this conversation.");
    }

    return ok(res, await serializeConversation(conversation, req.actor.id));
  }
);

messagesRouter.get(
  "/conversations/:id/messages",
  requireAuthenticatedActor,
  validate(conversationIdSchema),
  async (req, res) => {
    const result = await requireConversationParticipant(req.params.id, req.actor);
    if (result.error) {
      return fail(res, result.error[0] === "FORBIDDEN" ? 403 : 404, result.error[0], result.error[1]);
    }

    // Scope message visibility per participant. A participant only sees
    // messages sent at or after their `joinedAt` timestamp. Admins and the
    // order's client see all messages because they were part of the
    // conversation from the start (their joinedAt is set when the conversation
    // is first created).
    const me = (result.conversation.participants || []).find(
      (participant) =>
        participant.actorId === req.actor.id && participant.actorType === req.actor.type
    );
    const visibilityCutoff = me?.joinedAt ? new Date(me.joinedAt) : null;

    const messageQuery = { conversationId: req.params.id };
    if (visibilityCutoff) {
      messageQuery.createdAt = { $gte: visibilityCutoff };
    }

    const messages = await MessageModel.find(messageQuery)
      .sort({ createdAt: 1 })
      .lean();

    return ok(res, {
      conversation: await serializeConversation(result.conversation, req.actor.id),
      messages: messages.map((message) => serializeMessage(message, req.actor.id)),
    });
  }
);

messagesRouter.post(
  "/conversations/:id/messages",
  requireAuthenticatedActor,
  validate(sendMessageSchema),
  async (req, res) => {
    const result = await requireConversationParticipant(req.params.id, req.actor);
    if (result.error) {
      return fail(res, result.error[0] === "FORBIDDEN" ? 403 : 404, result.error[0], result.error[1]);
    }

    const created = await createMessage({
      conversation: result.conversation,
      actor: req.actor,
      body: req.body.body,
    });

    const payload = serializeMessage(created, req.actor.id);
    emitConversationMessage(req.params.id, payload);

    return ok(res, payload, "Message sent successfully.", 201);
  }
);

messagesRouter.post(
  "/conversations/:id/attachments",
  requireAuthenticatedActor,
  upload.array("attachments", 10),
  async (req, res) => {
    const result = await requireConversationParticipant(req.params.id, req.actor);
    if (result.error) {
      return fail(res, result.error[0] === "FORBIDDEN" ? 403 : 404, result.error[0], result.error[1]);
    }

    const attachments = await Promise.all(
      (req.files || []).map(async (file) =>
        buildAttachmentRecord(
          file,
          await storeUploadedFile(file, { folder: "notarix/messages/attachments" })
        )
      )
    );
    if (attachments.length === 0) {
      return fail(res, 400, "FILE_REQUIRED", "At least one attachment is required.");
    }

    const created = await createMessage({
      conversation: result.conversation,
      actor: req.actor,
      body: String(req.body?.body || ""),
      attachments,
    });

    const payload = serializeMessage(created, req.actor.id);
    emitConversationMessage(req.params.id, payload);

    return ok(res, payload, "Attachments uploaded successfully.", 201);
  }
);

messagesRouter.patch(
  "/messages/:id/read",
  requireAuthenticatedActor,
  validate(messageIdSchema),
  async (req, res) => {
    const message = await MessageModel.findOne({ id: req.params.id }).lean();
    if (!message) {
      return fail(res, 404, "MESSAGE_NOT_FOUND", "Message not found.");
    }

    const result = await requireConversationParticipant(message.conversationId, req.actor);
    if (result.error) {
      return fail(res, result.error[0] === "FORBIDDEN" ? 403 : 404, result.error[0], result.error[1]);
    }

    const alreadyRead = (message.readBy || []).some(
      (entry) => entry.actorId === req.actor.id && entry.actorType === req.actor.type
    );

    const updated = alreadyRead
      ? message
      : await MessageModel.findOneAndUpdate(
          { id: req.params.id },
          {
            $push: {
              readBy: {
                actorId: req.actor.id,
                actorType: req.actor.type,
                readAt: new Date(),
              },
            },
          },
          { new: true }
        ).lean();

    return ok(res, serializeMessage(updated, req.actor.id), "Message marked as read.");
  }
);

// Find or create a direct (non-order) conversation between the authenticated
// admin and a specific user. Used by the admin user-profile "Send Message"
// button to redirect the admin straight to the in-app conversation.
const adminDirectConversationSchema = z.object({
  body: z.object({
    userId: z.string().min(1),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

messagesRouter.post(
  "/admin/conversations/direct",
  requireAdminAuth,
  validate(adminDirectConversationSchema),
  async (req, res) => {
    const userId = String(req.body.userId || "").trim();
    const user = await UserModel.findOne({ id: userId }).lean();
    if (!user) {
      return fail(res, 404, "USER_NOT_FOUND", "User not found.");
    }

    const conversation = await ensureDirectConversation({
      admin: {
        id: req.admin.id,
        role: req.admin.role || "admin",
        name: req.admin.name || req.admin.email,
        email: req.admin.email,
      },
      user,
    });

    return ok(res, await serializeConversation(conversation, req.admin.id));
  }
);
