import { Router } from "express";
import { mutateStore, readStore } from "../../store.js";
import { requireAdminAuth } from "../../shared/http/auth-middleware.js";
import { fail, ok } from "../../shared/http/respond.js";

export const ordersRouter = Router();

ordersRouter.get("/admin/orders", requireAdminAuth, async (_req, res) => {
  const store = await readStore();
  return ok(res, store.orders);
});

ordersRouter.get("/admin/orders/:id", requireAdminAuth, async (req, res) => {
  const store = await readStore();
  const order = store.orders.find((item) => item.id === req.params.id);
  if (!order) {
    return fail(res, 404, "ORDER_NOT_FOUND", "Order not found.");
  }
  return ok(res, order);
});

ordersRouter.get("/admin/orders/:id/eligible-notaries", requireAdminAuth, async (_req, res) => {
  const store = await readStore();
  return ok(res, store.notaries);
});

ordersRouter.patch("/admin/orders/:id/assign-notary", requireAdminAuth, async (req, res) => {
  const { notaryId } = req.body || {};
  const updated = await mutateStore((store) => {
    const order = store.orders.find((item) => item.id === req.params.id);
    const notary = store.notaries.find((item) => item.id === notaryId);
    if (!order || !notary) {
      return null;
    }
    order.notaryId = notary.id;
    order.notary = notary.name;
    order.status = "Assigned";
    return order;
  });

  if (!updated) {
    return fail(res, 404, "ORDER_OR_NOTARY_NOT_FOUND", "Order or notary was not found.");
  }

  return ok(res, updated, "Notary assigned successfully.");
});

ordersRouter.patch("/admin/orders/:id/status", requireAdminAuth, async (req, res) => {
  const updated = await mutateStore((store) => {
    const order = store.orders.find((item) => item.id === req.params.id);
    if (!order) {
      return null;
    }
    order.status = String(req.body?.status || order.status);
    return order;
  });

  if (!updated) {
    return fail(res, 404, "ORDER_NOT_FOUND", "Order not found.");
  }

  return ok(res, updated, "Order status updated.");
});
