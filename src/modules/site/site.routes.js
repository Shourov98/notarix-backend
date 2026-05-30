import { Router } from "express";
import { z } from "zod";
import { readStore } from "../../store.js";
import { requireAuthenticatedActor } from "../../shared/http/auth-middleware.js";
import { fail, ok } from "../../shared/http/respond.js";
import { validate } from "../../shared/middleware/validate.js";
import {
  buildMaskedBankInfo,
  decryptBankInfo,
  encryptBankInfo,
} from "../../shared/security/bank-info.js";
import { UserModel } from "../users/user.model.js";

export const siteRouter = Router();

const siteBankInfoSchema = z.object({
  body: z.object({
    bankName: z.string().min(2),
    accountHolderName: z.string().min(2),
    accountType: z.enum(["checking", "savings", "business_checking"]),
    routingNumber: z.string().regex(/^\d{9}$/),
    accountNumber: z.string().regex(/^\d{6,17}$/),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

const ensurePortalRole = (req, res, roleLabel) => {
  if (req.actor?.type !== "user" || req.actor.role !== roleLabel) {
    fail(
      res,
      403,
      "FORBIDDEN",
      `Only ${roleLabel.toLowerCase()} users can access this resource.`
    );
    return false;
  }

  return true;
};

siteRouter.get("/site/client/overview", async (_req, res) => {
  const store = await readStore();
  const documents = store.siteClient.documents
    .map((docId) => store.documents.find((doc) => doc.id === docId))
    .filter(Boolean);

  return ok(res, {
    ...store.siteClient,
    documents,
  });
});

siteRouter.get("/site/notary/overview", async (_req, res) => {
  const store = await readStore();
  return ok(res, store.siteNotary);
});

siteRouter.get("/site/client/bank-info", requireAuthenticatedActor, async (req, res) => {
  if (!ensurePortalRole(req, res, "Client")) {
    return;
  }

  const user = await UserModel.findOne({ id: req.actor.id }).lean();

  if (!user) {
    return fail(res, 404, "USER_NOT_FOUND", "Client not found.");
  }

  const bankInfo = decryptBankInfo(user.bankInfoEncrypted);
  if (!bankInfo) {
    return fail(res, 404, "BANK_INFO_NOT_FOUND", "Bank info not found.");
  }

  return ok(res, bankInfo);
});

siteRouter.post(
  "/site/client/bank-info",
  requireAuthenticatedActor,
  validate(siteBankInfoSchema),
  async (req, res) => {
    if (!ensurePortalRole(req, res, "Client")) {
      return;
    }

    const encrypted = encryptBankInfo(req.body);
    const updated = await UserModel.findOneAndUpdate(
      { id: req.actor.id },
      {
        $set: {
          bankInfoEncrypted: encrypted.encrypted,
          bankInfoMasked: encrypted.masked,
          bankInfoUpdatedAt: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return fail(res, 404, "USER_NOT_FOUND", "Client not found.");
    }

    return ok(res, updated.bankInfoMasked, "Bank info saved successfully.", 201);
  }
);

siteRouter.patch(
  "/site/client/bank-info",
  requireAuthenticatedActor,
  validate(siteBankInfoSchema),
  async (req, res) => {
    if (!ensurePortalRole(req, res, "Client")) {
      return;
    }

    const encrypted = encryptBankInfo(req.body);
    const updated = await UserModel.findOneAndUpdate(
      { id: req.actor.id },
      {
        $set: {
          bankInfoEncrypted: encrypted.encrypted,
          bankInfoMasked: encrypted.masked,
          bankInfoUpdatedAt: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return fail(res, 404, "USER_NOT_FOUND", "Client not found.");
    }

    return ok(res, updated.bankInfoMasked, "Bank info updated successfully.");
  }
);

siteRouter.get("/site/notary/bank-info", requireAuthenticatedActor, async (req, res) => {
  if (!ensurePortalRole(req, res, "Notary")) {
    return;
  }

  const user = await UserModel.findOne({ id: req.actor.id }).lean();

  if (!user) {
    return fail(res, 404, "USER_NOT_FOUND", "Notary not found.");
  }

  const bankInfo = decryptBankInfo(user.bankInfoEncrypted);
  if (!bankInfo) {
    return fail(res, 404, "BANK_INFO_NOT_FOUND", "Bank info not found.");
  }

  return ok(res, bankInfo);
});

siteRouter.post(
  "/site/notary/bank-info",
  requireAuthenticatedActor,
  validate(siteBankInfoSchema),
  async (req, res) => {
    if (!ensurePortalRole(req, res, "Notary")) {
      return;
    }

    const encrypted = encryptBankInfo(req.body);
    const updated = await UserModel.findOneAndUpdate(
      { id: req.actor.id },
      {
        $set: {
          bankInfoEncrypted: encrypted.encrypted,
          bankInfoMasked: encrypted.masked,
          bankInfoUpdatedAt: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return fail(res, 404, "USER_NOT_FOUND", "Notary not found.");
    }

    return ok(res, updated.bankInfoMasked, "Bank info saved successfully.", 201);
  }
);

siteRouter.patch(
  "/site/notary/bank-info",
  requireAuthenticatedActor,
  validate(siteBankInfoSchema),
  async (req, res) => {
    if (!ensurePortalRole(req, res, "Notary")) {
      return;
    }

    const encrypted = encryptBankInfo(req.body);
    const updated = await UserModel.findOneAndUpdate(
      { id: req.actor.id },
      {
        $set: {
          bankInfoEncrypted: encrypted.encrypted,
          bankInfoMasked: encrypted.masked,
          bankInfoUpdatedAt: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return fail(res, 404, "USER_NOT_FOUND", "Notary not found.");
    }

    return ok(res, updated.bankInfoMasked, "Bank info updated successfully.");
  }
);

siteRouter.get("/site/admin/users/:id/bank-info", async (req, res) => {
  const user = await UserModel.findOne({ id: req.params.id }).lean();

  if (!user) {
    return fail(res, 404, "USER_NOT_FOUND", "User not found.");
  }

  const bankInfo = buildMaskedBankInfo(user);
  if (!bankInfo) {
    return fail(res, 404, "BANK_INFO_NOT_FOUND", "Bank info not found.");
  }

  return ok(res, bankInfo);
});

siteRouter.get("/site/documents/:id", async (req, res) => {
  const store = await readStore();
  const doc = store.documents.find((item) => item.id === req.params.id);

  if (!doc) {
    return fail(res, 404, "DOCUMENT_NOT_FOUND", "Document not found.");
  }

  return ok(res, doc);
});

siteRouter.get("/site/sessions/:id", async (req, res) => {
  const store = await readStore();
  const order =
    store.orders.find((item) => item.id === req.params.id) ||
    store.siteNotary.assignmentOrders.find((item) => item.id === req.params.id);

  if (!order) {
    return fail(res, 404, "SESSION_NOT_FOUND", "Session not found.");
  }

  return ok(res, {
    id: order.id,
    title: order.client || order.title,
    borrower: order.borrower || order.title,
    status: order.status,
    type: order.type || order.orderType,
    location: order.location,
    fee: order.fee || "$150.00",
  });
});
