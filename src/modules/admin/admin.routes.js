import { Router } from "express";
import { requireAdminAuth } from "../../shared/http/auth-middleware.js";
import { ok } from "../../shared/http/respond.js";
import { summarizeAdminConsole } from "../dashboard/dashboard.service.js";
import { AdminModel } from "../users/admin.model.js";
import { UserModel } from "../users/user.model.js";
import { OrderModel } from "../orders/order.model.js";
import { PaymentModel } from "../payments/payment.model.js";
import { MessageModel } from "../messages/message.model.js";

export const adminRouter = Router();

const serializeAdminOrder = (order) => ({
  id: `#${order.id}`,
  route: `/orders/${order.id}`,
  client: order.clientCompany || order.clientName,
  borrower: order.signerName,
  service: order.serviceType,
  location: [
    order.propertyAddress?.city,
    order.propertyAddress?.state,
    order.propertyAddress?.zip,
  ]
    .filter(Boolean)
    .join(", "),
  schedule: `${order.signingDate} ${order.signingTime}`.trim(),
  notary: order.notary || "Unassigned",
  notaryId: order.notaryId || null,
  status:
    order.status === "Pending Admin Review" ||
    order.status === "Accepted By Admin" ||
    order.status === "Rejected By Admin" ||
    order.status === "Needs Reassignment"
      ? "Pending"
      : order.status === "Notary Assigned" || order.status === "Accepted By Notary"
        ? "Assigned"
        : order.status,
  workflowStatus: order.status,
  type: order.isRon ? "RON" : "In-Person",
  fee: `$${Number(order.feeAmount || 0).toFixed(2)}`,
});

const buildNotaryRows = (users, orders) =>
  users
    .filter((user) => user.role === "Notary")
    .map((user) => ({
      id: user.id,
      name: user.name,
      location: user.area || user.address?.state || "Coverage unknown",
      radius: user.commission?.travelRadius || "Not specified",
      status: user.status || "Pending",
      jobs: `${orders.filter((order) => order.notaryId === user.id && order.status === "Completed").length} Jobs Completed`,
      tags: [
        ...(user.ronEligible ? ["RON"] : []),
        ...((user.specialties || []).filter(Boolean)),
      ].slice(0, 3),
      avatarTone: user.avatarTone || "bg-slate-200 text-slate-700",
    }));

const buildDocumentRows = (users) =>
  users.flatMap((user) =>
    (user.requiredDocuments || []).map((document) => ({
      id: document.id || `${user.id}-${document.title}`,
      orderId: "",
      uploadedBy: user.name,
      uploadedByLabel: user.name,
      title: document.title,
      status: document.status || "Missing",
      file: document.file || null,
    }))
  );

const buildMessageRows = (messages) =>
  messages.map((message) => ({
    id: message.id,
    senderName: message.senderName,
    senderRole: message.senderRole,
    orderId: message.orderId,
    preview: message.body || (message.attachments?.[0]?.name ? `Attachment: ${message.attachments[0].name}` : ""),
    createdAt: message.createdAt,
  }));

adminRouter.get("/admin/console", requireAdminAuth, async (req, res) => {
  const [admins, users, orders, payments, messages] = await Promise.all([
    AdminModel.find().lean(),
    UserModel.find().lean(),
    OrderModel.find().sort({ createdAt: -1 }).lean(),
    PaymentModel.find().sort({ createdAt: -1 }).lean(),
    MessageModel.find().sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  const snapshot = {
    admins,
    users,
    orders: orders.map(serializeAdminOrder),
    notaries: buildNotaryRows(users, orders),
    documents: buildDocumentRows(users),
    payments,
    messages: buildMessageRows(messages),
    supportTickets: [],
  };
  return ok(res, summarizeAdminConsole(snapshot, req.admin));
});

adminRouter.get("/admin/dashboard/stats", requireAdminAuth, async (req, res) => {
  const [admins, users, orders] = await Promise.all([
    AdminModel.find().lean(),
    UserModel.find().lean(),
    OrderModel.find().sort({ createdAt: -1 }).lean(),
  ]);
  const snapshot = {
    admins,
    users,
    orders: orders.map(serializeAdminOrder),
    notaries: buildNotaryRows(users, orders),
    documents: buildDocumentRows(users),
    payments: [],
    messages: [],
    supportTickets: [],
  };
  return ok(res, summarizeAdminConsole(snapshot, req.admin).metrics);
});
