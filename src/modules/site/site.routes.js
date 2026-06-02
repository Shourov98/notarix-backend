import { Router } from "express";
import { z } from "zod";
import {
  requireAdminAuth,
  requireAuthenticatedActor,
} from "../../shared/http/auth-middleware.js";
import { fail, ok } from "../../shared/http/respond.js";
import { validate } from "../../shared/middleware/validate.js";
import {
  buildMaskedBankInfo,
  decryptBankInfo,
  encryptBankInfo,
} from "../../shared/security/bank-info.js";
import { UserModel } from "../users/user.model.js";
import { OrderModel } from "../orders/order.model.js";
import { PaymentModel } from "../payments/payment.model.js";

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

const toCurrency = (value) => `$${Number(value || 0).toFixed(2)}`;

const serializeOrderPreview = (order) => ({
  id: order.id,
  title: order.clientCompany || order.clientName,
  borrower: order.signerName,
  status: order.status,
  type: order.isRon ? "RON" : "In-Person",
  location: order.isRon
    ? "Remote Online"
    : [order.propertyAddress?.city, order.propertyAddress?.state, order.propertyAddress?.zip]
        .filter(Boolean)
        .join(", "),
  fee: toCurrency(order.notaryOfferAmount ?? order.feeAmount ?? 0),
  date: `${order.signingDate} ${order.signingTime}`.trim(),
});

siteRouter.get("/site/client/overview", requireAuthenticatedActor, async (req, res) => {
  if (!ensurePortalRole(req, res, "Client")) {
    return;
  }

  const [user, orders, payments] = await Promise.all([
    UserModel.findOne({ id: req.actor.id }).lean(),
    OrderModel.find({ clientUserId: req.actor.id }).sort({ createdAt: -1 }).lean(),
    PaymentModel.find({ clientUserId: req.actor.id }).sort({ createdAt: -1 }).lean(),
  ]);

  if (!user) {
    return fail(res, 404, "USER_NOT_FOUND", "Client not found.");
  }

  const pendingOrders = orders.filter((order) =>
    ["Pending Admin Review", "Accepted By Admin", "Needs Reassignment"].includes(order.status)
  ).length;

  const completedOrders = orders.filter((order) => order.status === "Completed").length;
  const outstandingPayments = payments.reduce(
    (sum, payment) =>
      sum +
      (payment.clientPayment?.status === "Received"
        ? 0
        : Number(payment.clientPayment?.amount || 0)),
    0
  );

  return ok(res, {
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      company: user.organization?.companyName || user.company || "",
      status: user.status,
      verification: user.verification,
    },
    stats: {
      totalOrders: orders.length,
      pendingOrders,
      completedOrders,
      outstandingPayments: toCurrency(outstandingPayments),
    },
    documents: user.requiredDocuments || [],
    recentOrders: orders.slice(0, 5).map(serializeOrderPreview),
  });
});

siteRouter.get("/site/notary/overview", requireAuthenticatedActor, async (req, res) => {
  if (!ensurePortalRole(req, res, "Notary")) {
    return;
  }

  const [user, orders, payments] = await Promise.all([
    UserModel.findOne({ id: req.actor.id }).lean(),
    OrderModel.find({ notaryId: req.actor.id }).sort({ createdAt: -1 }).lean(),
    PaymentModel.find({ notaryId: req.actor.id }).sort({ createdAt: -1 }).lean(),
  ]);

  if (!user) {
    return fail(res, 404, "USER_NOT_FOUND", "Notary not found.");
  }

  const completedOrders = orders.filter((order) => order.status === "Completed");
  const openAssignments = orders.filter((order) =>
    ["Notary Assigned", "Accepted By Notary", "In Progress"].includes(order.status)
  );
  const pendingPayouts = payments.reduce(
    (sum, payment) =>
      sum +
      (payment.notaryPayout?.status === "Paid"
        ? 0
        : Number(payment.notaryPayout?.amount || 0)),
    0
  );

  return ok(res, {
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      verification: user.verification,
      ronEligible: Boolean(user.ronEligible),
    },
    stats: {
      totalAssignments: orders.length,
      openAssignments: openAssignments.length,
      completedAssignments: completedOrders.length,
      pendingPayouts: toCurrency(pendingPayouts),
    },
    documents: user.requiredDocuments || [],
    recentAssignments: orders.slice(0, 5).map(serializeOrderPreview),
  });
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

siteRouter.get("/site/admin/users/:id/bank-info", requireAdminAuth, async (req, res) => {
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
  return fail(
    res,
    410,
    "LEGACY_ENDPOINT_REMOVED",
    "This legacy endpoint has been removed. Use the secure /files endpoints instead."
  );
});

siteRouter.get("/site/sessions/:id", async (req, res) => {
  const order = await OrderModel.findOne({ id: req.params.id }).lean();

  if (!order) {
    return fail(res, 404, "SESSION_NOT_FOUND", "Session not found.");
  }

  return ok(res, {
    id: order.id,
    title: order.clientCompany || order.clientName,
    borrower: order.signerName,
    status: order.status,
    type: order.isRon ? "RON" : "In-Person",
    location: order.isRon
      ? "Remote Online"
      : [order.propertyAddress?.city, order.propertyAddress?.state, order.propertyAddress?.zip]
          .filter(Boolean)
          .join(", "),
    fee: toCurrency(order.notaryOfferAmount ?? order.feeAmount ?? 0),
  });
});
