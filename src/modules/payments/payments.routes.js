import { Router } from "express";
import { z } from "zod";
import {
  requireAdminAuth,
  requireAuthenticatedActor,
} from "../../shared/http/auth-middleware.js";
import { fail, ok } from "../../shared/http/respond.js";
import { validate } from "../../shared/middleware/validate.js";
import { upload } from "../../shared/storage/upload.js";
import { OrderModel } from "../orders/order.model.js";
import { PaymentModel } from "./payment.model.js";
import {
  createPaymentAuditEntry,
  ensurePaymentsForOrders,
  syncPaymentFromOrder,
} from "./payment.service.js";
import { createAuditLog } from "../audit/audit.service.js";

export const paymentsRouter = Router();

const listPaymentsSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    search: z.string().optional(),
    status: z.string().optional(),
    type: z.enum(["Inbound", "Outbound"]).optional(),
  }).passthrough(),
  params: z.object({}).passthrough(),
});

const orderIdSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().min(1) }),
});

const paymentTermsSchema = z.object({
  body: z.object({
    totalClientAmount: z.number().nonnegative().optional(),
    notaryPayoutAmount: z.number().nonnegative().optional(),
    payoutReleaseDays: z.number().int().nonnegative().optional(),
    clientPaymentMethod: z.string().optional(),
    clientDueDate: z.string().optional(),
    notes: z.string().optional(),
  }),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().min(1) }),
});

const paymentStatusSchema = z.object({
  body: z.object({
    target: z.enum(["client", "notary"]),
    status: z.string().min(1),
    method: z.string().optional(),
    paidDate: z.string().optional(),
    transactionReference: z.string().optional(),
    notes: z.string().optional(),
  }),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().min(1) }),
});

const normalizeOrderId = (value) => String(value || "").replace(/^#/, "");

const toDateOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const serializeProof = (proof, orderId = "", target = "") =>
  proof?.file
    ? {
        name: proof.name,
        url: `/api/v1/files/payments/${orderId}/${target}/proof?mode=view`,
        downloadUrl: `/api/v1/files/payments/${orderId}/${target}/proof?mode=download`,
        mimeType: proof.mimeType || null,
        size: proof.size || null,
        uploadedAt: proof.uploadedAt || null,
      }
    : null;

const serializeAuditEntry = (entry) => ({
  id: entry.id,
  target: entry.target,
  action: entry.action,
  status: entry.status,
  note: entry.note,
  changedById: entry.changedById,
  changedByRole: entry.changedByRole,
  changedAt: entry.changedAt,
});

const serializePaymentDetail = (payment) => ({
  id: payment.id,
  orderId: payment.orderId,
  orderStatus: payment.orderStatus,
  serviceType: payment.serviceType,
  client: {
    userId: payment.clientUserId,
    name: payment.clientName,
    email: payment.clientEmail,
    company: payment.clientCompany,
  },
  notary: payment.notaryId
    ? {
        userId: payment.notaryId,
        name: payment.notaryName,
        email: payment.notaryEmail,
      }
    : null,
  totalClientAmount: Number(payment.totalClientAmount || 0),
  notaryPayoutAmount: Number(payment.notaryPayoutAmount || 0),
  companyRevenueAmount: Number(payment.companyRevenueAmount || 0),
  clientPayment: {
    amount: Number(payment.clientPayment?.amount || 0),
    status: payment.clientPayment?.status || "Pending",
    method: payment.clientPayment?.method || "",
    dueDate: payment.clientPayment?.dueDate || null,
    paidDate: payment.clientPayment?.paidDate || null,
    notes: payment.clientPayment?.notes || "",
    transactionReference: payment.clientPayment?.transactionReference || "",
    proof: serializeProof(payment.clientPayment?.proof, payment.orderId, "client"),
  },
  notaryPayout: {
    amount: Number(payment.notaryPayout?.amount || 0),
    status: payment.notaryPayout?.status || "Pending",
    method: payment.notaryPayout?.method || "",
    dueDate: payment.notaryPayout?.dueDate || null,
    paidDate: payment.notaryPayout?.paidDate || null,
    releaseDays:
      typeof payment.notaryPayout?.releaseDays === "number"
        ? payment.notaryPayout.releaseDays
        : null,
    notes: payment.notaryPayout?.notes || "",
    transactionReference: payment.notaryPayout?.transactionReference || "",
    proof: serializeProof(payment.notaryPayout?.proof, payment.orderId, "notary"),
  },
  auditLog: (payment.auditLog || []).map(serializeAuditEntry),
  createdAt: payment.createdAt,
  updatedAt: payment.updatedAt,
});

const toCurrency = (value) => `$${Number(value || 0).toFixed(2)}`;

const toDateLabel = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not set";

const flattenAdminPaymentRows = (payments) =>
  payments.flatMap((payment) => {
    const rows = [
      {
        id: `${payment.id}-client`,
        paymentId: payment.id,
        orderId: `#${payment.orderId}`,
        rawOrderId: payment.orderId,
        direction: "Inbound",
        counterpartyName: payment.clientCompany || payment.clientName,
        counterpartyEmail: payment.clientEmail,
        description: `${payment.serviceType} · Client payment`,
        amount: Number(payment.clientPayment?.amount || 0),
        amountLabel: toCurrency(payment.clientPayment?.amount || 0),
        status: payment.clientPayment?.status || "Pending",
        method: payment.clientPayment?.method || "Not set",
        reference: payment.clientPayment?.transactionReference || "",
        dueDate: payment.clientPayment?.dueDate || null,
        dateLabel: toDateLabel(payment.clientPayment?.paidDate || payment.clientPayment?.dueDate),
        canUpdate: true,
        target: "client",
        proof: serializeProof(payment.clientPayment?.proof, payment.orderId, "client"),
      },
    ];

    if (payment.notaryId || Number(payment.notaryPayout?.amount || 0) > 0) {
      rows.push({
        id: `${payment.id}-notary`,
        paymentId: payment.id,
        orderId: `#${payment.orderId}`,
        rawOrderId: payment.orderId,
        direction: "Outbound",
        counterpartyName: payment.notaryName || "Unassigned notary",
        counterpartyEmail: payment.notaryEmail || "",
        description: `${payment.serviceType} · Notary payout`,
        amount: Number(payment.notaryPayout?.amount || 0),
        amountLabel: toCurrency(payment.notaryPayout?.amount || 0),
        status: payment.notaryPayout?.status || "Pending",
        method: payment.notaryPayout?.method || "Not set",
        reference: payment.notaryPayout?.transactionReference || "",
        dueDate: payment.notaryPayout?.dueDate || null,
        dateLabel: toDateLabel(payment.notaryPayout?.paidDate || payment.notaryPayout?.dueDate),
        canUpdate: true,
        target: "notary",
        proof: serializeProof(payment.notaryPayout?.proof, payment.orderId, "notary"),
      });
    }

    return rows;
  });

const buildPaymentSummary = (payments) => ({
  totalClientRevenue: payments.reduce(
    (total, payment) => total + Number(payment.totalClientAmount || 0),
    0
  ),
  totalNotaryPayouts: payments.reduce(
    (total, payment) => total + Number(payment.notaryPayoutAmount || 0),
    0
  ),
  totalCompanyRevenue: payments.reduce(
    (total, payment) => total + Number(payment.companyRevenueAmount || 0),
    0
  ),
  pendingInbound: payments.reduce(
    (total, payment) =>
      total +
      (payment.clientPayment?.status === "Received"
        ? 0
        : Number(payment.clientPayment?.amount || 0)),
    0
  ),
  pendingOutbound: payments.reduce(
    (total, payment) =>
      total +
      (payment.notaryPayout?.status === "Paid"
        ? 0
        : Number(payment.notaryPayout?.amount || 0)),
    0
  ),
});

const findOrderAndPayment = async (orderId) => {
  const order = await OrderModel.findOne({ id: normalizeOrderId(orderId) }).lean();
  if (!order) return { order: null, payment: null };
  const payment = await syncPaymentFromOrder(order);
  return { order, payment };
};

paymentsRouter.get(
  "/admin/payments",
  requireAdminAuth,
  validate(listPaymentsSchema),
  async (req, res) => {
    const orders = await OrderModel.find().sort({ createdAt: -1 }).lean();
    const payments = await ensurePaymentsForOrders(orders);
    const rows = flattenAdminPaymentRows(payments).filter((row) => {
      if (req.query.type && row.direction !== req.query.type) return false;
      if (req.query.status && row.status !== req.query.status) return false;

      if (req.query.search) {
        const query = String(req.query.search).toLowerCase();
        const haystack = [
          row.orderId,
          row.counterpartyName,
          row.counterpartyEmail,
          row.description,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      }

      return true;
    });

    return ok(res, {
      summary: buildPaymentSummary(payments),
      payments: rows,
    });
  }
);

paymentsRouter.get(
  "/admin/orders/:id/payment",
  requireAdminAuth,
  validate(orderIdSchema),
  async (req, res) => {
    const { payment } = await findOrderAndPayment(req.params.id);
    if (!payment) {
      return fail(res, 404, "PAYMENT_NOT_FOUND", "Payment record not found.");
    }

    return ok(res, serializePaymentDetail(payment));
  }
);

paymentsRouter.patch(
  "/admin/orders/:id/payment-terms",
  requireAdminAuth,
  validate(paymentTermsSchema),
  async (req, res) => {
    const { order } = await findOrderAndPayment(req.params.id);
    if (!order) {
      return fail(res, 404, "ORDER_NOT_FOUND", "Order not found.");
    }

    const extraSet = {};
    if (typeof req.body.totalClientAmount === "number") {
      extraSet.feeAmount = req.body.totalClientAmount;
    }
    if (typeof req.body.notaryPayoutAmount === "number") {
      extraSet.notaryOfferAmount = req.body.notaryPayoutAmount;
    }
    if (typeof req.body.payoutReleaseDays === "number") {
      extraSet.payoutReleaseDays = req.body.payoutReleaseDays;
    }
    if (typeof req.body.clientPaymentMethod === "string") {
      extraSet.paymentMethod = req.body.clientPaymentMethod;
    }
    if (typeof req.body.clientDueDate === "string") {
      extraSet.dueDate = req.body.clientDueDate;
    }
    if (typeof req.body.notes === "string") {
      extraSet.paymentNotes = req.body.notes;
    }

    await OrderModel.updateOne({ id: normalizeOrderId(req.params.id) }, { $set: extraSet });
    const updatedOrder = await OrderModel.findOne({ id: normalizeOrderId(req.params.id) }).lean();
    const updatedPayment = await syncPaymentFromOrder(updatedOrder);

    await PaymentModel.updateOne(
      { orderId: updatedOrder.id },
      {
        $push: {
          auditLog: createPaymentAuditEntry({
            target: "terms",
            action: "payment-terms-updated",
            status: "Updated",
            note: "Payment terms updated by admin.",
            actor: req.admin,
          }),
        },
      }
    );

    const finalPayment = await PaymentModel.findOne({ orderId: updatedOrder.id }).lean();
    await createAuditLog({
      action: "payment.terms_updated",
      entityType: "payment",
      entityId: finalPayment.id,
      title: "Payment terms updated",
      summary: `Payment terms updated for ${updatedOrder.id}.`,
      actor: req.admin,
      metadata: req.body,
    });
    return ok(res, serializePaymentDetail(finalPayment || updatedPayment), "Payment terms updated successfully.");
  }
);

paymentsRouter.patch(
  "/admin/orders/:id/payment-status",
  requireAdminAuth,
  validate(paymentStatusSchema),
  async (req, res) => {
    const { order, payment } = await findOrderAndPayment(req.params.id);
    if (!order || !payment) {
      return fail(res, 404, "PAYMENT_NOT_FOUND", "Payment record not found.");
    }

    const sideKey = req.body.target === "client" ? "clientPayment" : "notaryPayout";
    const updatePayload = {
      [`${sideKey}.status`]: req.body.status,
      [`${sideKey}.method`]: req.body.method ?? payment[sideKey]?.method ?? "",
      [`${sideKey}.transactionReference`]:
        req.body.transactionReference ?? payment[sideKey]?.transactionReference ?? "",
      [`${sideKey}.notes`]:
        req.body.notes ?? payment[sideKey]?.notes ?? "",
    };

    const paidDate = toDateOrNull(req.body.paidDate) || new Date();
    if (
      (req.body.target === "client" && req.body.status === "Received") ||
      (req.body.target === "notary" && req.body.status === "Paid")
    ) {
      updatePayload[`${sideKey}.paidDate`] = paidDate;
    }

    await PaymentModel.updateOne(
      { orderId: order.id },
      {
        $set: updatePayload,
        $push: {
          auditLog: createPaymentAuditEntry({
            target: req.body.target,
            action:
              req.body.target === "client"
                ? "client-payment-status-updated"
                : "notary-payout-status-updated",
            status: req.body.status,
            note: req.body.notes || "",
            actor: req.admin,
          }),
        },
      }
    );

    if (req.body.target === "client") {
      await OrderModel.updateOne(
        { id: order.id },
        {
          $set: {
            paymentStatus: req.body.status,
            paymentMethod: req.body.method ?? order.paymentMethod ?? "",
            paidDate:
              req.body.status === "Received" ? paidDate.toISOString() : order.paidDate || "",
            paymentNotes: req.body.notes ?? order.paymentNotes ?? "",
          },
        }
      );
    }

    const updated = await PaymentModel.findOne({ orderId: order.id }).lean();
    await createAuditLog({
      action: "payment.status_updated",
      entityType: "payment",
      entityId: updated.id,
      title: "Payment status updated",
      summary: `${req.body.target} payment marked as ${req.body.status}.`,
      actor: req.admin,
      metadata: { orderId: order.id, target: req.body.target, status: req.body.status },
    });
    return ok(res, serializePaymentDetail(updated), "Payment status updated successfully.");
  }
);

paymentsRouter.post(
  "/admin/orders/:id/payment-proof",
  requireAdminAuth,
  upload.single("proof"),
  async (req, res) => {
    const target = req.body?.target;
    if (!["client", "notary"].includes(target)) {
      return fail(res, 400, "INVALID_TARGET", "A valid payment target is required.");
    }
    if (!req.file) {
      return fail(res, 400, "FILE_REQUIRED", "Payment proof file is required.");
    }

    const { order, payment } = await findOrderAndPayment(req.params.id);
    if (!order || !payment) {
      return fail(res, 404, "PAYMENT_NOT_FOUND", "Payment record not found.");
    }

    const sideKey = target === "client" ? "clientPayment" : "notaryPayout";
    const proof = {
      name: req.file.originalname,
      file: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date(),
    };

    await PaymentModel.updateOne(
      { orderId: order.id },
      {
        $set: {
          [`${sideKey}.proof`]: proof,
        },
        $push: {
          auditLog: createPaymentAuditEntry({
            target,
            action: "payment-proof-uploaded",
            status: "Uploaded",
            note: `Uploaded ${target} payment proof.`,
            actor: req.admin,
          }),
        },
      }
    );

    const updated = await PaymentModel.findOne({ orderId: order.id }).lean();
    await createAuditLog({
      action: "payment.proof_uploaded",
      entityType: "payment",
      entityId: updated.id,
      title: "Payment proof uploaded",
      summary: `${target} payment proof uploaded for ${order.id}.`,
      actor: req.admin,
      metadata: { target, fileName: proof.name },
    });
    return ok(res, serializePaymentDetail(updated), "Payment proof uploaded successfully.", 201);
  }
);

paymentsRouter.get(
  "/site/client/payments",
  requireAuthenticatedActor,
  async (req, res) => {
    if (req.actor.type !== "user" || req.actor.role !== "Client") {
      return fail(res, 403, "FORBIDDEN", "Only client users can access payments.");
    }

    const orders = await OrderModel.find({ clientUserId: req.actor.id })
      .sort({ createdAt: -1 })
      .lean();
    const payments = await ensurePaymentsForOrders(orders);

    const summary = {
      totalOrderValue: payments.reduce(
        (total, payment) => total + Number(payment.totalClientAmount || 0),
        0
      ),
      totalPaid: payments.reduce(
        (total, payment) =>
          total +
          (payment.clientPayment?.status === "Received"
            ? Number(payment.clientPayment?.amount || 0)
            : 0),
        0
      ),
      pending: payments.reduce(
        (total, payment) =>
          total +
          (payment.clientPayment?.status === "Received"
            ? 0
            : Number(payment.clientPayment?.amount || 0)),
        0
      ),
    };

    return ok(res, {
      summary,
      records: payments.map((payment) => ({
        id: payment.id,
        orderId: `#${payment.orderId}`,
        route: `/dashboard-client/orders/${payment.orderId}`,
        signerName: payment.clientName,
        companyName: payment.clientCompany,
        amount: Number(payment.clientPayment?.amount || 0),
        amountLabel: toCurrency(payment.clientPayment?.amount || 0),
        status: payment.clientPayment?.status || "Pending",
        method: payment.clientPayment?.method || "Not set",
        dueDate: payment.clientPayment?.dueDate || null,
        dueDateLabel: toDateLabel(payment.clientPayment?.dueDate),
        paidDate: payment.clientPayment?.paidDate || null,
        reference: payment.clientPayment?.transactionReference || "",
        proof: serializeProof(payment.clientPayment?.proof, payment.orderId, "client"),
      })),
    });
  }
);

paymentsRouter.get(
  "/site/notary/payments",
  requireAuthenticatedActor,
  async (req, res) => {
    if (req.actor.type !== "user" || req.actor.role !== "Notary") {
      return fail(res, 403, "FORBIDDEN", "Only notary users can access payouts.");
    }

    const orders = await OrderModel.find({ notaryId: req.actor.id })
      .sort({ createdAt: -1 })
      .lean();
    const synced = await ensurePaymentsForOrders(orders);
    const payments = synced.filter((payment) => payment.notaryId === req.actor.id);

    const summary = {
      totalEarned: payments.reduce(
        (total, payment) => total + Number(payment.notaryPayout?.amount || 0),
        0
      ),
      totalPaid: payments.reduce(
        (total, payment) =>
          total +
          (payment.notaryPayout?.status === "Paid"
            ? Number(payment.notaryPayout?.amount || 0)
            : 0),
        0
      ),
      pending: payments.reduce(
        (total, payment) =>
          total +
          (payment.notaryPayout?.status === "Paid"
            ? 0
            : Number(payment.notaryPayout?.amount || 0)),
        0
      ),
    };

    return ok(res, {
      summary,
      records: payments.map((payment) => ({
        id: payment.id,
        orderId: `#${payment.orderId}`,
        route: `/dashboard-notary/assignments-orders/${payment.orderId}`,
        clientName: payment.clientCompany || payment.clientName,
        amount: Number(payment.notaryPayout?.amount || 0),
        amountLabel: toCurrency(payment.notaryPayout?.amount || 0),
        status: payment.notaryPayout?.status || "Pending",
        method: payment.notaryPayout?.method || "Not set",
        dueDate: payment.notaryPayout?.dueDate || null,
        dueDateLabel: toDateLabel(payment.notaryPayout?.dueDate),
        paidDate: payment.notaryPayout?.paidDate || null,
        reference: payment.notaryPayout?.transactionReference || "",
        releaseDays:
          typeof payment.notaryPayout?.releaseDays === "number"
            ? payment.notaryPayout.releaseDays
            : null,
        proof: serializeProof(payment.notaryPayout?.proof, payment.orderId, "notary"),
      })),
    });
  }
);
