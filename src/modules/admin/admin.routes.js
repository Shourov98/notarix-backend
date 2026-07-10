import { Router } from "express";
import { requireAdminAuth } from "../../shared/http/auth-middleware.js";
import { fail, ok } from "../../shared/http/respond.js";
import { validate } from "../../shared/middleware/validate.js";
import { summarizeAdminConsole } from "../dashboard/dashboard.service.js";
import { AdminModel } from "../users/admin.model.js";
import { UserModel } from "../users/user.model.js";
import { OrderModel } from "../orders/order.model.js";
import { PaymentModel } from "../payments/payment.model.js";
import { MessageModel } from "../messages/message.model.js";
import { adminStore } from "./admin.store.js";
import {
  companySettingsUpdateSchema,
  notificationPreferencesUpdateSchema,
  supportTicketCreateSchema,
  supportTicketUpdateSchema,
} from "./admin.schemas.js";
import { emitAdminAudience } from "../../shared/realtime/socket.js";

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
  signingDate: order.signingDate || "",
  signingTime: order.signingTime || "",
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
  feeAmount: Number(order.feeAmount || 0),
  notaryOfferAmount: Number(order.notaryOfferAmount || 0),
  payoutReleaseDays:
    typeof order.payoutReleaseDays === "number" ? order.payoutReleaseDays : null,
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

// Time-series dataset for the admin dashboard trend chart. Returns
// orders and revenue grouped by day for the last `days` days (default 14).
adminRouter.get("/admin/dashboard/timeseries", requireAdminAuth, async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 14, 1), 60);
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const orders = await OrderModel.find({ createdAt: { $gte: since } })
    .select({ createdAt: 1, feeAmount: 1, status: 1 })
    .lean();

  const payments = await PaymentModel.find({ createdAt: { $gte: since } })
    .select({ createdAt: 1, amount: 1, status: 1, direction: 1 })
    .lean();

  const dayKey = (value) => {
    const date = new Date(value);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
      date.getUTCDate()
    ).padStart(2, "0")}`;
  };

  // Seed every day in the window so the chart shows zeros for empty days.
  const buckets = new Map();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(since);
    date.setUTCDate(date.getUTCDate() + offset);
    const key = dayKey(date);
    buckets.set(key, {
      key,
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      orders: 0,
      completedOrders: 0,
      revenue: 0,
      payouts: 0,
    });
  }

  orders.forEach((order) => {
    const bucket = buckets.get(dayKey(order.createdAt));
    if (!bucket) return;
    bucket.orders += 1;
    if (order.status === "Completed") {
      bucket.completedOrders += 1;
      bucket.revenue += Number(order.feeAmount || 0);
    }
  });

  payments.forEach((payment) => {
    const bucket = buckets.get(dayKey(payment.createdAt));
    if (!bucket) return;
    if (payment.direction === "outbound") {
      bucket.payouts += Number(payment.amount || 0);
    } else if (payment.direction === "inbound" && payment.status === "Paid") {
      bucket.revenue += Number(payment.amount || 0);
    }
  });

  const series = Array.from(buckets.values());
  const totals = series.reduce(
    (acc, entry) => {
      acc.orders += entry.orders;
      acc.revenue += entry.revenue;
      acc.payouts += entry.payouts;
      acc.completedOrders += entry.completedOrders;
      return acc;
    },
    { orders: 0, revenue: 0, payouts: 0, completedOrders: 0 }
  );

  return ok(res, {
    days,
    series,
    totals: {
      ...totals,
      netProfit: totals.revenue - totals.payouts,
    },
  });
});

adminRouter.get("/admin/support/tickets", requireAdminAuth, async (req, res) => {
  const { status, search } = req.query;
  const tickets = adminStore.listSupportTickets({ status, search });
  return ok(res, tickets, "Support tickets fetched.");
});

adminRouter.get("/admin/support/tickets/:id", requireAdminAuth, async (req, res) => {
  const ticket = adminStore.getSupportTicket(req.params.id);
  if (!ticket) {
    return fail(res, 404, "TICKET_NOT_FOUND", "Support ticket not found.");
  }
  return ok(res, ticket, "Support ticket fetched.");
});

adminRouter.post(
  "/admin/support/tickets",
  requireAdminAuth,
  validate(supportTicketCreateSchema),
  async (req, res) => {
    const ticket = adminStore.createSupportTicket(req.body);
    emitAdminAudience("support_ticket_created", ticket);
    return ok(res, ticket, "Support ticket created.", 201);
  }
);

adminRouter.patch(
  "/admin/support/tickets/:id",
  requireAdminAuth,
  validate(supportTicketUpdateSchema),
  async (req, res) => {
    const ticket = adminStore.updateSupportTicket(req.params.id, req.body);
    if (!ticket) {
      return fail(res, 404, "TICKET_NOT_FOUND", "Support ticket not found.");
    }
    emitAdminAudience("support_ticket_updated", ticket);
    return ok(res, ticket, "Support ticket updated.");
  }
);

adminRouter.get("/admin/settings/company", requireAdminAuth, async (_req, res) => {
  return ok(res, adminStore.getCompanySettings(), "Company settings fetched.");
});

adminRouter.patch(
  "/admin/settings/company",
  requireAdminAuth,
  validate(companySettingsUpdateSchema),
  async (req, res) => {
    const settings = adminStore.updateCompanySettings(req.body);
    return ok(res, settings, "Company settings updated.");
  }
);

adminRouter.get("/admin/settings/notifications", requireAdminAuth, async (req, res) => {
  const prefs = adminStore.getNotificationPreferences(req.admin.id);
  return ok(res, prefs, "Notification preferences fetched.");
});

adminRouter.patch(
  "/admin/settings/notifications",
  requireAdminAuth,
  validate(notificationPreferencesUpdateSchema),
  async (req, res) => {
    const prefs = adminStore.updateNotificationPreferences(req.admin.id, req.body);
    return ok(res, prefs, "Notification preferences updated.");
  }
);

adminRouter.get("/admin/settings/security", requireAdminAuth, async (req, res) => {
  const currentSession = {
    id: "current",
    device: "Web Dashboard",
    ip: req.ip || "127.0.0.1",
    lastActive: new Date().toISOString(),
    current: true,
  };
  const admin = await AdminModel.findById(req.admin.id).lean();
  return ok(
    res,
    {
      sessions: [currentSession],
      passwordLastChanged: admin?.updatedAt || null,
      twoFactorEnabled: false,
    },
    "Security settings fetched."
  );
});

adminRouter.post(
  "/admin/settings/security/sessions/:id/revoke",
  requireAdminAuth,
  async (_req, res) => {
    return ok(res, { ok: true }, "Session revoked.");
  }
);
