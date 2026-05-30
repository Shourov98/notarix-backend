import crypto from "node:crypto";
import { PaymentModel } from "./payment.model.js";

const toDateOrNull = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const createPaymentAuditEntry = ({
  target,
  action,
  status = "",
  note = "",
  actor,
}) => ({
  id: `pmt-audit-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
  target,
  action,
  status,
  note,
  changedById: actor?.id || null,
  changedByRole: actor?.role || actor?.type || null,
  changedAt: new Date(),
});

export const getCompletedAt = (order) => {
  const completedEntry = (order.statusHistory || [])
    .filter((entry) => entry.status === "Completed")
    .sort((left, right) => new Date(right.changedAt) - new Date(left.changedAt))[0];

  return completedEntry?.changedAt ? new Date(completedEntry.changedAt) : null;
};

export const buildPayoutDueDateFromDate = (completedAt, releaseDays = 0) => {
  if (!completedAt) return null;
  const date = new Date(completedAt);
  date.setDate(date.getDate() + Number(releaseDays || 0));
  return date;
};

const normalizeClientPaymentStatus = (order, existing) =>
  existing?.clientPayment?.status || order.paymentStatus || "Pending";

const normalizeNotaryPayoutStatus = (order, existing) => {
  if (existing?.notaryPayout?.status) {
    return existing.notaryPayout.status;
  }

  if (!order.notaryId) {
    return "Pending";
  }

  if (order.status === "Completed" && order.payoutDueDate) {
    return "Scheduled";
  }

  return "Pending";
};

export const syncPaymentFromOrder = async (order, overrides = {}) => {
  const existing = await PaymentModel.findOne({ orderId: order.id }).lean();
  const completedAt = getCompletedAt(order);
  const payoutDueDate =
    toDateOrNull(order.payoutDueDate) ||
    buildPayoutDueDateFromDate(completedAt, order.payoutReleaseDays);

  const totalClientAmount = Number(order.feeAmount || 0);
  const notaryPayoutAmount = Number(order.notaryOfferAmount || 0);
  const companyRevenueAmount = Math.max(totalClientAmount - notaryPayoutAmount, 0);

  const nextRecord = {
    id: existing?.id || `pay-${order.id}`,
    orderId: order.id,
    orderStatus: order.status,
    serviceType: order.serviceType || "",
    clientUserId: order.clientUserId,
    clientName: order.clientName || "",
    clientEmail: order.clientEmail || "",
    clientCompany: order.clientCompany || "",
    notaryId: order.notaryId || null,
    notaryName: order.notary && order.notary !== "Unassigned" ? order.notary : "",
    notaryEmail: overrides.notaryEmail || existing?.notaryEmail || "",
    totalClientAmount,
    notaryPayoutAmount,
    companyRevenueAmount,
    clientPayment: {
      amount: totalClientAmount,
      status: normalizeClientPaymentStatus(order, existing),
      method: existing?.clientPayment?.method || order.paymentMethod || "",
      dueDate: toDateOrNull(existing?.clientPayment?.dueDate) || toDateOrNull(order.dueDate),
      paidDate: toDateOrNull(existing?.clientPayment?.paidDate) || toDateOrNull(order.paidDate),
      releaseDays: null,
      notes: order.paymentNotes || existing?.clientPayment?.notes || "",
      transactionReference: existing?.clientPayment?.transactionReference || "",
      proof: existing?.clientPayment?.proof || null,
    },
    notaryPayout: {
      amount: notaryPayoutAmount,
      status: normalizeNotaryPayoutStatus(order, existing),
      method: existing?.notaryPayout?.method || "",
      dueDate: payoutDueDate,
      paidDate: toDateOrNull(existing?.notaryPayout?.paidDate),
      releaseDays:
        typeof order.payoutReleaseDays === "number" ? order.payoutReleaseDays : null,
      notes: existing?.notaryPayout?.notes || order.assignmentNotes || "",
      transactionReference: existing?.notaryPayout?.transactionReference || "",
      proof: existing?.notaryPayout?.proof || null,
    },
    auditLog:
      existing?.auditLog?.length
        ? existing.auditLog
        : [
            createPaymentAuditEntry({
              target: "system",
              action: "payment-record-created",
              status: "Synced",
              note: "Payment record created from order lifecycle.",
              actor: { id: "system", role: "system" },
            }),
          ],
  };

  await PaymentModel.findOneAndUpdate(
    { orderId: order.id },
    { $set: nextRecord },
    { upsert: true, new: true }
  );

  return PaymentModel.findOne({ orderId: order.id }).lean();
};

export const ensurePaymentsForOrders = async (orders) => {
  const records = [];

  for (const order of orders) {
    records.push(await syncPaymentFromOrder(order));
  }

  return records;
};
