import { Router } from "express";
import mongoose from "mongoose";
import { requireAdminAuth } from "../../shared/http/auth-middleware.js";
import { fail, ok } from "../../shared/http/respond.js";
import { validate } from "../../shared/middleware/validate.js";
import { queueEmail } from "../../shared/notifications/email.service.js";
import { createNotification } from "../../shared/notifications/notification.service.js";
import { UserRequestModel } from "./user-request.model.js";
import {
  createRequestSchema,
  rejectRequestSchema,
} from "./requests.schemas.js";

export const requestsRouter = Router();

const ensureRequestsDatabase = (res) => {
  if (mongoose.connection.readyState !== 1) {
    fail(
      res,
      503,
      "DATABASE_UNAVAILABLE",
      "Database is not connected. Requests cannot be processed right now."
    );
    return false;
  }

  return true;
};

requestsRouter.post("/requests", validate(createRequestSchema), async (req, res) => {
  if (!ensureRequestsDatabase(res)) {
    return;
  }

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
  };

  await UserRequestModel.create(requestRecord);

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
  if (!ensureRequestsDatabase(res)) {
    return;
  }

  const status = String(req.query.status || "").trim();
  const query = status
    ? { status: new RegExp(`^${status}$`, "i") }
    : {};
  const results = await UserRequestModel.find(query)
    .sort({ createdAt: -1 })
    .lean();
  return ok(res, results);
});

requestsRouter.get("/admin/requests/:id", requireAdminAuth, async (req, res) => {
  if (!ensureRequestsDatabase(res)) {
    return;
  }

  const requestItem = await UserRequestModel.findOne({ id: req.params.id }).lean();
  if (!requestItem) {
    return fail(res, 404, "REQUEST_NOT_FOUND", "Request not found.");
  }
  return ok(res, requestItem);
});

requestsRouter.patch("/admin/requests/:id/approve", requireAdminAuth, async (req, res) => {
  if (!ensureRequestsDatabase(res)) {
    return;
  }

  const requestId = req.params.id;
  const result = await UserRequestModel.findOneAndUpdate(
    { id: requestId },
    { status: "Approved" },
    { new: true, lean: true }
  );

  if (!result) {
    return fail(res, 404, "REQUEST_NOT_FOUND", "Request not found.");
  }

  await createNotification({
    title: "Your access request was approved",
    meta: `${result.requestType} request approved`,
    action: "Check your email",
    audience: "user",
    entityType: "user_request",
    entityId: requestId,
  });

  await queueEmail({
    to: result.email,
    subject: "Your Notarix access request was approved",
    text: `Hello ${result.name}, your ${result.requestType} request has been approved.`,
    html: `<p>Hello ${result.name},</p><p>Your ${result.requestType} request has been approved.</p>`,
    category: "user-request-approved",
  });

  return ok(res, { requestId, status: "Approved" }, "Request approved successfully.");
});

requestsRouter.patch("/admin/requests/:id/reject", requireAdminAuth, validate(rejectRequestSchema), async (req, res) => {
  if (!ensureRequestsDatabase(res)) {
    return;
  }

  const requestId = req.params.id;
  const result = await UserRequestModel.findOneAndUpdate(
    { id: requestId },
    {
      status: "Rejected",
      rejectionReason: String(req.body?.reason || ""),
    },
    { new: true, lean: true }
  );

  if (!result) {
    return fail(res, 404, "REQUEST_NOT_FOUND", "Request not found.");
  }

  await createNotification({
    title: "Your access request was rejected",
    meta: `${result.requestType} request rejected`,
    action: "Review the rejection reason",
    audience: "user",
    entityType: "user_request",
    entityId: requestId,
  });

  await queueEmail({
    to: result.email,
    subject: "Your Notarix access request was rejected",
    text: `Hello ${result.name}, your ${result.requestType} request was rejected. Reason: ${result.rejectionReason}`,
    html: `<p>Hello ${result.name},</p><p>Your ${result.requestType} request was rejected.</p><p>Reason: ${result.rejectionReason}</p>`,
    category: "user-request-rejected",
  });

  return ok(res, { requestId, status: "Rejected" }, "Request rejected successfully.");
});
