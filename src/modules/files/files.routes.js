import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";
import { config } from "../../config.js";
import { requireAuthenticatedActor } from "../../shared/http/auth-middleware.js";
import { fail } from "../../shared/http/respond.js";
import { validate } from "../../shared/middleware/validate.js";
import { UserModel } from "../users/user.model.js";
import { OrderModel } from "../orders/order.model.js";
import { ConversationModel } from "../messages/conversation.model.js";
import { MessageModel } from "../messages/message.model.js";
import { PaymentModel } from "../payments/payment.model.js";

export const filesRouter = Router();

const userDocSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({ mode: z.enum(["view", "download"]).optional() }).passthrough(),
  params: z.object({ userId: z.string().min(1), documentId: z.string().min(1) }),
});

const userAvatarSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({ mode: z.enum(["view", "download"]).optional() }).passthrough(),
  params: z.object({ userId: z.string().min(1) }),
});

const orderDocSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({ mode: z.enum(["view", "download"]).optional() }).passthrough(),
  params: z.object({
    orderId: z.string().min(1),
    bucket: z.enum(["documents", "completed-documents"]),
    documentId: z.string().min(1),
  }),
});

const messageAttachmentSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({ mode: z.enum(["view", "download"]).optional() }).passthrough(),
  params: z.object({
    conversationId: z.string().min(1),
    attachmentId: z.string().min(1),
  }),
});

const paymentProofSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({ mode: z.enum(["view", "download"]).optional() }).passthrough(),
  params: z.object({
    orderId: z.string().min(1),
    target: z.enum(["client", "notary"]),
  }),
});

const isAdmin = (actor) => actor?.type === "admin";

const sendStoredFile = (res, file, mode = "view") => {
  if (!file?.file) {
    return fail(res, 404, "FILE_NOT_FOUND", "File not found.");
  }

  const absolutePath = path.resolve(process.cwd(), config.uploadTmpDir, file.file);
  if (!fs.existsSync(absolutePath)) {
    return fail(res, 404, "FILE_NOT_FOUND", "File not found on disk.");
  }

  if (file.mimeType) {
    res.type(file.mimeType);
  }

  const disposition = mode === "download" ? "attachment" : "inline";
  res.setHeader("Content-Disposition", `${disposition}; filename="${file.name || "document"}"`);
  return res.sendFile(absolutePath);
};

filesRouter.get(
  "/files/users/:userId/avatar",
  requireAuthenticatedActor,
  validate(userAvatarSchema),
  async (req, res) => {
    const user = await UserModel.findOne({ id: req.params.userId }).lean();
    if (!user) {
      return fail(res, 404, "USER_NOT_FOUND", "User not found.");
    }

    if (!isAdmin(req.actor) && req.actor.id !== user.id) {
      return fail(res, 403, "FORBIDDEN", "You do not have access to this file.");
    }

    const avatarFile = user.avatar ? String(user.avatar).split("/").pop() : null;
    if (!avatarFile) {
      return fail(res, 404, "FILE_NOT_FOUND", "Profile photo not found.");
    }

    return sendStoredFile(
      res,
      {
        name: path.basename(avatarFile),
        file: avatarFile,
        mimeType: null,
      },
      req.query.mode
    );
  }
);

filesRouter.get(
  "/files/users/:userId/documents/:documentId",
  requireAuthenticatedActor,
  validate(userDocSchema),
  async (req, res) => {
    const user = await UserModel.findOne({ id: req.params.userId }).lean();
    if (!user) {
      return fail(res, 404, "USER_NOT_FOUND", "User not found.");
    }

    if (!isAdmin(req.actor) && req.actor.id !== user.id) {
      return fail(res, 403, "FORBIDDEN", "You do not have access to this file.");
    }

    const document = (user.requiredDocuments || []).find((item) => item.id === req.params.documentId);
    if (!document) {
      return fail(res, 404, "DOCUMENT_NOT_FOUND", "Document not found.");
    }

    return sendStoredFile(res, document, req.query.mode);
  }
);

filesRouter.get(
  "/files/orders/:orderId/:bucket/:documentId",
  requireAuthenticatedActor,
  validate(orderDocSchema),
  async (req, res) => {
    const order = await OrderModel.findOne({ id: req.params.orderId.replace(/^#/, "") }).lean();
    if (!order) {
      return fail(res, 404, "ORDER_NOT_FOUND", "Order not found.");
    }

    const allowed =
      isAdmin(req.actor) ||
      req.actor.id === order.clientUserId ||
      req.actor.id === order.notaryId;
    if (!allowed) {
      return fail(res, 403, "FORBIDDEN", "You do not have access to this file.");
    }

    const bucket = req.params.bucket === "completed-documents" ? "completedDocuments" : "documents";
    const document = (order[bucket] || []).find((item) => item.id === req.params.documentId);
    if (!document) {
      return fail(res, 404, "DOCUMENT_NOT_FOUND", "Document not found.");
    }

    return sendStoredFile(res, document, req.query.mode);
  }
);

filesRouter.get(
  "/files/conversations/:conversationId/attachments/:attachmentId",
  requireAuthenticatedActor,
  validate(messageAttachmentSchema),
  async (req, res) => {
    const conversation = await ConversationModel.findOne({ id: req.params.conversationId }).lean();
    if (!conversation) {
      return fail(res, 404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
    }

    const isParticipant = (conversation.participants || []).some(
      (participant) =>
        participant.actorId === req.actor.id && participant.actorType === req.actor.type
    );

    if (!isParticipant) {
      return fail(res, 403, "FORBIDDEN", "You do not have access to this file.");
    }

    const message = await MessageModel.findOne({
      conversationId: req.params.conversationId,
      "attachments.id": req.params.attachmentId,
    }).lean();

    const attachment = (message?.attachments || []).find((item) => item.id === req.params.attachmentId);
    if (!attachment) {
      return fail(res, 404, "ATTACHMENT_NOT_FOUND", "Attachment not found.");
    }

    return sendStoredFile(res, attachment, req.query.mode);
  }
);

filesRouter.get(
  "/files/payments/:orderId/:target/proof",
  requireAuthenticatedActor,
  validate(paymentProofSchema),
  async (req, res) => {
    const payment = await PaymentModel.findOne({ orderId: req.params.orderId.replace(/^#/, "") }).lean();
    if (!payment) {
      return fail(res, 404, "PAYMENT_NOT_FOUND", "Payment record not found.");
    }

    const allowed =
      isAdmin(req.actor) ||
      req.actor.id === payment.clientUserId ||
      req.actor.id === payment.notaryId;
    if (!allowed) {
      return fail(res, 403, "FORBIDDEN", "You do not have access to this file.");
    }

    const proof =
      req.params.target === "client"
        ? payment.clientPayment?.proof
        : payment.notaryPayout?.proof;

    return sendStoredFile(res, proof, req.query.mode);
  }
);
