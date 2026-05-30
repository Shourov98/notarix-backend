import { Router } from "express";
import { readStore } from "../../store.js";
import { requireAdminAuth } from "../../shared/http/auth-middleware.js";
import { ok } from "../../shared/http/respond.js";
import { summarizeAdminConsole } from "../dashboard/dashboard.service.js";
import { AdminModel } from "../users/admin.model.js";
import { UserModel } from "../users/user.model.js";
import { OrderModel } from "../orders/order.model.js";

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

adminRouter.get("/admin/console", requireAdminAuth, async (req, res) => {
  const [store, admins, users, orders] = await Promise.all([
    readStore(),
    AdminModel.find().lean(),
    UserModel.find().lean(),
    OrderModel.find().sort({ createdAt: -1 }).lean(),
  ]);
  const snapshot = {
    ...store,
    admins,
    users,
    orders: orders.map(serializeAdminOrder),
  };
  return ok(res, summarizeAdminConsole(snapshot, req.admin));
});

adminRouter.get("/admin/dashboard/stats", requireAdminAuth, async (req, res) => {
  const [store, admins, users, orders] = await Promise.all([
    readStore(),
    AdminModel.find().lean(),
    UserModel.find().lean(),
    OrderModel.find().sort({ createdAt: -1 }).lean(),
  ]);
  const snapshot = {
    ...store,
    admins,
    users,
    orders: orders.map(serializeAdminOrder),
  };
  return ok(res, summarizeAdminConsole(snapshot, req.admin).metrics);
});
