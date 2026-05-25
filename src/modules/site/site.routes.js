import { Router } from "express";
import { readStore } from "../../store.js";
import { fail, ok } from "../../shared/http/respond.js";

export const siteRouter = Router();

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
