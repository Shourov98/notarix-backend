import { Router } from "express";
import { mutateStore, readStore } from "../../store.js";
import { requireAdminAuth } from "../../shared/http/auth-middleware.js";
import { fail, ok } from "../../shared/http/respond.js";
import { validate } from "../../shared/middleware/validate.js";
import { createNotification } from "../../shared/notifications/notification.service.js";
import {
  createRequestSchema,
  rejectRequestSchema,
} from "./requests.schemas.js";

export const requestsRouter = Router();

requestsRouter.post("/requests", validate(createRequestSchema), async (req, res) => {
  const {
    name,
    email,
    phone = "",
    companyName = "",
    contactType,
    requestType,
    state = "",
    message = "",
  } = req.body || {};

  if (!name || !email || !contactType || !requestType) {
    return fail(
      res,
      400,
      "INVALID_INPUT",
      "Name, email, contact type, and request type are required."
    );
  }

  const requestRecord = {
    id: `req-${Date.now()}`,
    name,
    email: String(email).toLowerCase(),
    phone,
    companyName,
    contactType,
    requestType,
    state,
    message,
    status: "Pending",
    createdAt: new Date().toISOString(),
  };

  await mutateStore((store) => {
    store.requests.unshift(requestRecord);
  });

  await createNotification({
    title: "New access request submitted",
    meta: `${requestRecord.name} · ${requestRecord.requestType} · ${requestRecord.state || "No state provided"}`,
    action: "Review Request",
    audience: "admin",
    entityType: "user_request",
    entityId: requestRecord.id,
  });

  return ok(
    res,
    { requestId: requestRecord.id, status: requestRecord.status },
    "Request submitted successfully",
    201
  );
});

requestsRouter.get("/admin/requests", requireAdminAuth, async (req, res) => {
  const store = await readStore();
  const status = String(req.query.status || "").trim();
  const results = status
    ? store.requests.filter((item) => item.status.toLowerCase() === status.toLowerCase())
    : store.requests;
  return ok(res, results);
});

requestsRouter.get("/admin/requests/:id", requireAdminAuth, async (req, res) => {
  const store = await readStore();
  const requestItem = store.requests.find((item) => item.id === req.params.id);
  if (!requestItem) {
    return fail(res, 404, "REQUEST_NOT_FOUND", "Request not found.");
  }
  return ok(res, requestItem);
});

requestsRouter.patch("/admin/requests/:id/approve", requireAdminAuth, async (req, res) => {
  const requestId = req.params.id;
  const result = await mutateStore((store) => {
    const requestItem = store.requests.find((item) => item.id === requestId);
    if (!requestItem) {
      return null;
    }
    requestItem.status = "Approved";
    return requestItem;
  });

  if (!result) {
    return fail(res, 404, "REQUEST_NOT_FOUND", "Request not found.");
  }

  return ok(res, { requestId, status: "Approved" }, "Request approved successfully.");
});

requestsRouter.patch("/admin/requests/:id/reject", requireAdminAuth, validate(rejectRequestSchema), async (req, res) => {
  const requestId = req.params.id;
  const result = await mutateStore((store) => {
    const requestItem = store.requests.find((item) => item.id === requestId);
    if (!requestItem) {
      return null;
    }
    requestItem.status = "Rejected";
    requestItem.rejectionReason = String(req.body?.reason || "");
    return requestItem;
  });

  if (!result) {
    return fail(res, 404, "REQUEST_NOT_FOUND", "Request not found.");
  }

  return ok(res, { requestId, status: "Rejected" }, "Request rejected successfully.");
});
