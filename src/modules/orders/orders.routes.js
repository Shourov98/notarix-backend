import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import {
  requireAdminAuth,
  requireAuthenticatedActor,
} from "../../shared/http/auth-middleware.js";
import { fail, ok } from "../../shared/http/respond.js";
import {
  buildPaginationMeta,
  parsePaginationQuery,
} from "../../shared/http/pagination.js";
import { validate } from "../../shared/middleware/validate.js";
import { upload } from "../../shared/storage/upload.js";
import {
  normalizeCloudinaryUrl,
  storeUploadedFile,
} from "../../shared/storage/cloudinary.js";
import { OrderModel } from "./order.model.js";
import { UserModel } from "../users/user.model.js";
import { queueEmail } from "../../shared/notifications/email.service.js";
import { createNotification } from "../../shared/notifications/notification.service.js";
import { ensureOrderConversation } from "../messages/messages.service.js";
import { syncPaymentFromOrder } from "../payments/payment.service.js";
import { createAuditLog } from "../audit/audit.service.js";
import {
  emitAssignmentUpdated,
  emitOrderStatusUpdated,
} from "../../shared/realtime/socket.js";
import {
  ORDER_STATUSES,
  canTransitionOrderStatus,
  getOrderTransitionError,
  requiresCompletedDocumentsForCompletion,
  serializeStatus,
} from "./order-workflow.service.js";

export const ordersRouter = Router();

const orderCreateSchema = z.object({
  body: z.object({
    vendorCode: z.string().min(1),
    serviceType: z.string().min(1),
    signerFirstName: z.string().min(1),
    signerLastName: z.string().min(1),
    signerPhone: z.string().min(7),
    signerEmail: z.string().email(),
    hasSecondarySigner: z.boolean().optional(),
    propertyAddress: z.object({
      line1: z.string().min(2),
      city: z.string().min(2),
      state: z.string().min(2),
      zip: z.string().min(2),
      timeZone: z.string().optional(),
    }),
    signingDate: z.string().min(1),
    signingTime: z.string().min(1),
    feeAmount: z.number().nonnegative(),
    paymentStatus: z.string().optional(),
    paymentMethod: z.string().optional(),
    dueDate: z.string().optional(),
    paidDate: z.string().optional(),
    paymentNotes: z.string().optional(),
    paperSize: z.string().optional(),
    preferredInk: z.string().optional(),
    estimatedPages: z.string().optional(),
    isRon: z.boolean().optional(),
    specialInstructions: z.string().optional(),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

const listOrdersSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    search: z.string().optional(),
    status: z.string().optional(),
    serviceType: z.string().optional(),
    page: z.string().optional(),
    pageSize: z.string().optional(),
  }).passthrough(),
  params: z.object({}).passthrough(),
});

const orderIdParamsSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().min(1) }),
});

const rejectOrderSchema = z.object({
  body: z.object({
    reason: z.string().min(2),
  }),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().min(1) }),
});

const orderStatusSchema = z.object({
  body: z.object({
    status: z.enum(ORDER_STATUSES),
    note: z.string().optional(),
  }),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().min(1) }),
});

const orderDocumentStatusSchema = z.object({
  body: z.object({
    status: z.enum(["Pending", "Verified", "Rejected"]),
    reviewNote: z.string().optional(),
  }),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().min(1),
    documentId: z.string().min(1),
  }),
});

const assignNotarySchema = z.object({
  body: z.object({
    notaryId: z.string().min(1),
    notaryOfferAmount: z.number().nonnegative().optional(),
    payoutReleaseDays: z.number().int().nonnegative().optional(),
    assignmentNotes: z.string().optional(),
  }),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().min(1) }),
});

const notaryActionSchema = z.object({
  body: z.object({
    note: z.string().optional(),
  }).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().min(1) }),
});

const notaryRejectSchema = z.object({
  body: z.object({
    reason: z.string().min(2),
  }),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().min(1) }),
});

const normalizeId = (value) => String(value || "").replace(/^#/, "");

const buildOrderRoute = (order) => `/orders/${order.id}`;
const buildClientOrderRoute = (order) => `/dashboard-client/orders/${order.id}`;
const buildNotaryOrderRoute = (order) => `/dashboard-notary/assignments-orders/${order.id}`;

const buildTimeline = (order) =>
  (order.statusHistory || [])
    .slice()
    .sort((left, right) => new Date(left.changedAt) - new Date(right.changedAt))
    .map((entry) => ({
      status: entry.status,
      note: entry.note || "",
      changedById: entry.changedById || null,
      changedByRole: entry.changedByRole || null,
      changedAt: entry.changedAt,
    }));

const serializeAdminOrder = (order) => ({
  id: `#${order.id}`,
  rawId: order.id,
  route: buildOrderRoute(order),
  client: order.clientCompany || order.clientName,
  clientEmail: order.clientEmail,
  borrower: order.signerName,
  borrowerEmail: order.signerEmail,
  borrowerPhone: order.signerPhone,
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
  status: serializeStatus(order.status),
  workflowStatus: order.status,
  type: order.isRon ? "RON" : "In-Person",
  fee: `$${Number(order.feeAmount || 0).toFixed(2)}`,
  feeAmount: Number(order.feeAmount || 0),
  notaryOfferAmount: Number(order.notaryOfferAmount || 0),
  payoutReleaseDays:
    typeof order.payoutReleaseDays === "number" ? order.payoutReleaseDays : null,
  createdAt: order.createdAt,
});

const serializeAdminOrderDetail = (order) => ({
  ...serializeAdminOrder(order),
  vendorCode: order.vendorCode,
  signerFirstName: order.signerFirstName,
  signerLastName: order.signerLastName,
  hasSecondarySigner: Boolean(order.hasSecondarySigner),
  propertyAddress: order.propertyAddress || {},
  signingDate: order.signingDate,
  signingTime: order.signingTime,
  payment: {
    feeAmount: Number(order.feeAmount || 0),
    paymentStatus: order.paymentStatus || "Pending",
    paymentMethod: order.paymentMethod || "",
    dueDate: order.dueDate || "",
    paidDate: order.paidDate || "",
    paymentNotes: order.paymentNotes || "",
    notaryOfferAmount: order.notaryOfferAmount,
    payoutReleaseDays: order.payoutReleaseDays,
    payoutDueDate: order.payoutDueDate || null,
    assignmentNotes: order.assignmentNotes || "",
  },
  preferences: {
    paperSize: order.paperSize || "Letter",
    preferredInk: order.preferredInk || "Black",
    estimatedPages: order.estimatedPages || "",
    isRon: Boolean(order.isRon),
  },
  specialInstructions: order.specialInstructions || "",
  adminReviewReason: order.adminReviewReason || "",
  documents: (order.documents || []).map((document) => {
    const isHostedOnCloudinary = typeof document.url === "string" && document.url.startsWith("http");
    const cloudinaryUrl = isHostedOnCloudinary
      ? normalizeCloudinaryUrl(document.url, document.mimeType, { sign: true })
      : null;
    const fallbackView = document.file
      ? `/api/v1/files/orders/${order.id}/documents/${document.id}?mode=view`
      : null;
    const fallbackDownload = document.file
      ? `/api/v1/files/orders/${order.id}/documents/${document.id}?mode=download`
      : null;
    return {
      id: document.id,
      name: document.name,
      status: document.status || "Pending",
      reviewNote: document.reviewNote || "",
      url: fallbackView || cloudinaryUrl,
      downloadUrl: fallbackDownload || cloudinaryUrl,
      mimeType: document.mimeType || null,
      size: document.size || null,
      uploadedAt: document.uploadedAt || null,
    };
  }),
  completedDocuments: (order.completedDocuments || []).map((document) => {
    const isHostedOnCloudinary = typeof document.url === "string" && document.url.startsWith("http");
    const cloudinaryUrl = isHostedOnCloudinary
      ? normalizeCloudinaryUrl(document.url, document.mimeType, { sign: true })
      : null;
    const fallbackView = document.file
      ? `/api/v1/files/orders/${order.id}/completed-documents/${document.id}?mode=view`
      : null;
    const fallbackDownload = document.file
      ? `/api/v1/files/orders/${order.id}/completed-documents/${document.id}?mode=download`
      : null;
    return {
      id: document.id,
      name: document.name,
      url: fallbackView || cloudinaryUrl,
      downloadUrl: fallbackDownload || cloudinaryUrl,
      mimeType: document.mimeType || null,
      size: document.size || null,
      uploadedAt: document.uploadedAt || null,
    };
  }),
  timeline: buildTimeline(order),
});

const serializeClientOrder = (order) => ({
  id: `#${order.id}`,
  route: buildClientOrderRoute(order),
  signerName: order.signerName,
  serviceType: order.serviceType,
  location: order.isRon
    ? "Remote Online"
    : [
        order.propertyAddress?.city,
        order.propertyAddress?.state,
        order.propertyAddress?.zip,
      ]
        .filter(Boolean)
        .join(", "),
  date: order.signingDate,
  status: serializeStatus(order.status),
  workflowStatus: order.status,
  notary: order.notary && order.notary !== "Unassigned"
    ? { name: order.notary, avatar: null }
    : null,
});

const hasVerifiedOrderDocuments = (order) =>
  Array.isArray(order?.documents) &&
  order.documents.length > 0 &&
  order.documents.every((document) => document?.status === "Verified");

const assertVerifiedOrderDocuments = (res, order, message) => {
  if (!Array.isArray(order?.documents) || order.documents.length === 0) {
    fail(
      res,
      400,
      "ORDER_DOCUMENTS_REQUIRED",
      "At least one client-uploaded order document is required before this action."
    );
    return true;
  }

  if (!hasVerifiedOrderDocuments(order)) {
    fail(
      res,
      400,
      "ORDER_DOCUMENTS_UNVERIFIED",
      message ||
        "All client-uploaded order documents must be verified before this action."
    );
    return true;
  }

  return false;
};

const serializeNotaryAssignment = (order) => {
  const orderDocuments = (order.documents || []).map((document) => {
    const isHostedOnCloudinary = typeof document.url === "string" && document.url.startsWith("http");
    const cloudinaryUrl = isHostedOnCloudinary
      ? normalizeCloudinaryUrl(document.url, document.mimeType, { sign: true })
      : null;
    const fallbackView = document.file
      ? `/api/v1/files/orders/${order.id}/documents/${document.id}?mode=view`
      : null;
    const fallbackDownload = document.file
      ? `/api/v1/files/orders/${order.id}/documents/${document.id}?mode=download`
      : null;
    return {
      id: document.id,
      name: document.name,
      title: document.name,
      status: document.status || "Pending",
      reviewNote: document.reviewNote || "",
      url: fallbackView || cloudinaryUrl,
      downloadUrl: fallbackDownload || cloudinaryUrl,
      mimeType: document.mimeType || null,
      size: document.size || null,
      uploadedAt: document.uploadedAt || null,
      uploadedBy: "Client",
    };
  });
  const completedDocuments = (order.completedDocuments || []).map((document) => {
    const isHostedOnCloudinary = typeof document.url === "string" && document.url.startsWith("http");
    const cloudinaryUrl = isHostedOnCloudinary
      ? normalizeCloudinaryUrl(document.url, document.mimeType, { sign: true })
      : null;
    const fallbackView = document.file
      ? `/api/v1/files/orders/${order.id}/completed-documents/${document.id}?mode=view`
      : null;
    const fallbackDownload = document.file
      ? `/api/v1/files/orders/${order.id}/completed-documents/${document.id}?mode=download`
      : null;
    return {
      id: document.id,
      name: document.name,
      title: document.name,
      status: "Verified",
      url: fallbackView || cloudinaryUrl,
      downloadUrl: fallbackDownload || cloudinaryUrl,
      mimeType: document.mimeType || null,
      size: document.size || null,
      uploadedAt: document.uploadedAt || null,
      uploadedBy: "Notary",
    };
  });

  return {
    id: `#${order.id}`,
    rawId: order.id,
    route: buildNotaryOrderRoute(order),
    orderType: order.isRon ? "RON" : "In-Person",
    title: order.clientCompany || order.clientName,
    borrower: order.signerName,
    location: order.isRon
      ? "Remote Online"
      : [
          order.propertyAddress?.city,
          order.propertyAddress?.state,
          order.propertyAddress?.zip,
        ]
          .filter(Boolean)
          .join(", "),
    date: `${order.signingDate} ${order.signingTime}`.trim(),
    fee: `$${Number(order.notaryOfferAmount ?? order.feeAmount ?? 0).toFixed(2)}`,
    status: order.status,
    workflowStatus: order.status,
    documents: [...orderDocuments, ...completedDocuments],
  };
};

const serializeNotaryAssignmentDetail = (order) => {
  const originalDocuments = (order.documents || []).map((document) => {
    const isHostedOnCloudinary = typeof document.url === "string" && document.url.startsWith("http");
    const cloudinaryUrl = isHostedOnCloudinary
      ? normalizeCloudinaryUrl(document.url, document.mimeType, { sign: true })
      : null;
    const fallbackView = document.file
      ? `/api/v1/files/orders/${order.id}/documents/${document.id}?mode=view`
      : null;
    const fallbackDownload = document.file
      ? `/api/v1/files/orders/${order.id}/documents/${document.id}?mode=download`
      : null;
    return {
      id: document.id,
      name: document.name,
      status: document.status || "Pending",
      reviewNote: document.reviewNote || "",
      url: fallbackView || cloudinaryUrl,
      downloadUrl: fallbackDownload || cloudinaryUrl,
      mimeType: document.mimeType || null,
      size: document.size || null,
      uploadedAt: document.uploadedAt || null,
    };
  });

  const completedDocuments = (order.completedDocuments || []).map((document) => {
    const isHostedOnCloudinary = typeof document.url === "string" && document.url.startsWith("http");
    const cloudinaryUrl = isHostedOnCloudinary
      ? normalizeCloudinaryUrl(document.url, document.mimeType, { sign: true })
      : null;
    const fallbackView = document.file
      ? `/api/v1/files/orders/${order.id}/completed-documents/${document.id}?mode=view`
      : null;
    const fallbackDownload = document.file
      ? `/api/v1/files/orders/${order.id}/completed-documents/${document.id}?mode=download`
      : null;
    return {
      id: document.id,
      name: document.name,
      url: fallbackView || cloudinaryUrl,
      downloadUrl: fallbackDownload || cloudinaryUrl,
      mimeType: document.mimeType || null,
      size: document.size || null,
      uploadedAt: document.uploadedAt || null,
    };
  });

  const documentVerification = {
    total: originalDocuments.length,
    verified: originalDocuments.filter((document) => document.status === "Verified").length,
    pending: originalDocuments.filter((document) => document.status === "Pending").length,
    rejected: originalDocuments.filter((document) => document.status === "Rejected").length,
  };

  return {
    ...serializeNotaryAssignment(order),
    client: {
      name: order.clientName || "",
      company: order.clientCompany || "",
      email: order.clientEmail || "",
      vendorCode: order.vendorCode || "",
    },
    borrower: {
      name: order.signerName || "",
      email: order.signerEmail || "",
      phone: order.signerPhone || "",
      firstName: order.signerFirstName || "",
      lastName: order.signerLastName || "",
      hasSecondarySigner: Boolean(order.hasSecondarySigner),
    },
    property: {
      line1: order.propertyAddress?.line1 || "",
      city: order.propertyAddress?.city || "",
      state: order.propertyAddress?.state || "",
      zip: order.propertyAddress?.zip || "",
      timeZone: order.propertyAddress?.timeZone || "",
      fullAddress: [
        order.propertyAddress?.line1,
        order.propertyAddress?.city,
        order.propertyAddress?.state,
        order.propertyAddress?.zip,
      ]
        .filter(Boolean)
        .join(", "),
    },
    schedule: {
      signingDate: order.signingDate,
      signingTime: order.signingTime,
      dateTime: `${order.signingDate} ${order.signingTime}`.trim(),
    },
    service: {
      type: order.serviceType || "",
      orderType: order.isRon ? "Remote Online" : "In-Person",
      mode: order.isRon ? "Digital Notarization" : "Physical Signing",
      isRon: Boolean(order.isRon),
    },
    payment: {
      feeAmount: Number(order.feeAmount || 0),
      paymentStatus: order.paymentStatus || "Pending",
      paymentMethod: order.paymentMethod || "",
      dueDate: order.dueDate || "",
      paidDate: order.paidDate || "",
      paymentNotes: order.paymentNotes || "",
      notaryOfferAmount: Number(order.notaryOfferAmount ?? order.feeAmount ?? 0),
      payoutReleaseDays:
        typeof order.payoutReleaseDays === "number" ? order.payoutReleaseDays : null,
      payoutDueDate: order.payoutDueDate || null,
      assignmentNotes: order.assignmentNotes || "",
    },
    preferences: {
      paperSize: order.paperSize || "Letter",
      preferredInk: order.preferredInk || "Black",
      estimatedPages: order.estimatedPages || "",
    },
    specialInstructions: order.specialInstructions || "",
    statusHistory: buildTimeline(order),
    documents: originalDocuments,
    completedDocuments,
    documentVerification,
    actionState: {
      canAccept: order.status === "Notary Assigned",
      canReject: order.status === "Notary Assigned",
      canStart: order.status === "Accepted By Notary",
      canUploadCompletedDocuments: ["In Progress", "Completed"].includes(order.status),
      canComplete:
        order.status === "In Progress" && (order.completedDocuments || []).length > 0,
      requiresCompletedDocumentsForCompletion:
        order.status === "In Progress" && (order.completedDocuments || []).length === 0,
    },
  };
};

const createStatusHistoryEntry = (status, actor, note = "") => ({
  status,
  note,
  changedById: actor?.id || null,
  changedByRole: actor?.role || actor?.type || null,
  changedAt: new Date(),
});

const buildOrderSearchQuery = ({ search = "", status = "", serviceType = "" }) => {
  const query = {};

  if (search) {
    query.$or = [
      { id: { $regex: search, $options: "i" } },
      { clientName: { $regex: search, $options: "i" } },
      { clientCompany: { $regex: search, $options: "i" } },
      { signerName: { $regex: search, $options: "i" } },
      { signerEmail: { $regex: search, $options: "i" } },
      { notary: { $regex: search, $options: "i" } },
    ];
  }

  if (serviceType) {
    query.serviceType = new RegExp(`^${serviceType}$`, "i");
  }

  if (status) {
    if (status === "Pending") {
      query.status = {
        $in: [
          "Pending Admin Review",
          "Accepted By Admin",
          "Rejected By Admin",
          "Needs Reassignment",
        ],
      };
    } else if (status === "Assigned") {
      query.status = {
        $in: ["Notary Assigned", "Accepted By Notary"],
      };
    } else {
      query.status = new RegExp(`^${status}$`, "i");
    }
  }

  return query;
};

const findOrderById = (id) => OrderModel.findOne({ id: normalizeId(id) });

const findNotaryOrderById = (id, notaryId) =>
  OrderModel.findOne({ id: normalizeId(id), notaryId });

const assertTransitionOrFail = (res, currentStatus, nextStatus) => {
  const errorMessage = getOrderTransitionError(currentStatus, nextStatus);
  if (!errorMessage) {
    return false;
  }

  fail(res, 400, "INVALID_STATUS", errorMessage);
  return true;
};

const updateOrderStatus = async ({ id, status, actor, note = "", extraSet = {} }) =>
  OrderModel.findOneAndUpdate(
    { id: normalizeId(id) },
    {
      $set: {
        status,
        ...extraSet,
      },
      $push: {
        statusHistory: createStatusHistoryEntry(status, actor, note),
      },
    },
    { new: true }
  ).lean();

const appendOrderDocuments = async ({ orderId, field, files }) =>
  OrderModel.findOneAndUpdate(
    { id: normalizeId(orderId) },
    {
      $push: {
        [field]: { $each: files },
      },
    },
    { new: true }
  ).lean();

const buildPayoutDueDate = (releaseDays = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + Number(releaseDays || 0));
  return date;
};

const notifyAdmins = async ({ title, meta, action, entityId }) =>
  createNotification({
    title,
    meta,
    action,
    audience: "admin",
    entityType: "order",
    entityId,
  });

const notifyUserAudience = async ({
  title,
  meta,
  action,
  audience,
  entityId,
  recipientId = null,
  recipientType = null,
}) =>
  createNotification({
    title,
    meta,
    action,
    audience,
    recipientId,
    recipientType,
    entityType: "order",
    entityId,
  });

const notifySpecificUser = async ({ title, meta, action, userId, entityId }) =>
  createNotification({
    title,
    meta,
    action,
    audience: "user",
    recipientId: userId,
    recipientType: "user",
    entityType: "order",
    entityId,
  });

ordersRouter.post(
  "/site/orders",
  requireAuthenticatedActor,
  validate(orderCreateSchema),
  async (req, res) => {
    if (req.actor.type !== "user" || req.actor.role !== "Client") {
      return fail(res, 403, "FORBIDDEN", "Only client users can create orders.");
    }

    const user = req.actor.record;
    const signerName = `${req.body.signerFirstName} ${req.body.signerLastName}`.trim();
    const orderId = `${req.body.isRon ? "RON" : "ORD"}-${Date.now()}`;
    const initialStatus = "Pending Admin Review";

    const order = await OrderModel.create({
      id: orderId,
      clientUserId: user.id,
      clientEmail: user.email,
      clientName: user.primaryContact?.name || user.name,
      clientCompany: user.organization?.companyName || user.company || "",
      vendorCode: req.body.vendorCode,
      serviceType: req.body.serviceType,
      signerFirstName: req.body.signerFirstName,
      signerLastName: req.body.signerLastName,
      signerName,
      signerPhone: req.body.signerPhone,
      signerEmail: req.body.signerEmail,
      hasSecondarySigner: Boolean(req.body.hasSecondarySigner),
      propertyAddress: req.body.propertyAddress,
      signingDate: req.body.signingDate,
      signingTime: req.body.signingTime,
      feeAmount: req.body.feeAmount,
      paymentStatus: req.body.paymentStatus || "Pending",
      paymentMethod: req.body.paymentMethod || "",
      dueDate: req.body.dueDate || "",
      paidDate: req.body.paidDate || "",
      paymentNotes: req.body.paymentNotes || "",
      paperSize: req.body.paperSize || "Letter",
      preferredInk: req.body.preferredInk || "Black",
      estimatedPages: req.body.estimatedPages || "",
      isRon: Boolean(req.body.isRon),
      specialInstructions: req.body.specialInstructions || "",
      status: initialStatus,
      notary: "Unassigned",
      documents: [],
      statusHistory: [
        createStatusHistoryEntry(initialStatus, req.actor, "Order submitted by client."),
      ],
    });

    await notifyAdmins({
      title: "New order requires review",
      meta: `${order.clientCompany || order.clientName} · ${order.signerName}`,
      action: "Review Order",
      entityId: order.id,
    });

    await syncPaymentFromOrder(order.toObject());
    emitOrderStatusUpdated(order.toObject(), {
      previousStatus: null,
      changedBy: req.actor.id,
      event: "created",
    });
    await createAuditLog({
      action: "order.created",
      entityType: "order",
      entityId: order.id,
      title: "Order created",
      summary: `${order.clientCompany || order.clientName} submitted a new order.`,
      actor: req.actor,
      metadata: { serviceType: order.serviceType, feeAmount: order.feeAmount },
    });

    return ok(
      res,
      {
        orderId: order.id,
        status: serializeStatus(order.status),
        workflowStatus: order.status,
      },
      "Order created successfully.",
      201
    );
  }
);

ordersRouter.get(
  "/site/client/orders",
  requireAuthenticatedActor,
  async (req, res) => {
    if (req.actor.type !== "user" || req.actor.role !== "Client") {
      return fail(res, 403, "FORBIDDEN", "Only client users can access client orders.");
    }

    const orders = await OrderModel.find({ clientUserId: req.actor.id })
      .sort({ createdAt: -1 })
      .lean();

    return ok(res, {
      orders: orders.map(serializeClientOrder),
      recentOrders: orders.slice(0, 5).map((order) => ({
        id: `#${order.id}`,
        type: order.serviceType,
        status: serializeStatus(order.status),
        workflowStatus: order.status,
        name: order.signerName,
        date: order.signingDate,
      })),
    });
  }
);

ordersRouter.get(
  "/site/client/orders/:id",
  requireAuthenticatedActor,
  validate(orderIdParamsSchema),
  async (req, res) => {
    if (req.actor.type !== "user" || req.actor.role !== "Client") {
      return fail(res, 403, "FORBIDDEN", "Only client users can access client orders.");
    }

    const order = await OrderModel.findOne({
      id: normalizeId(req.params.id),
      clientUserId: req.actor.id,
    }).lean();

    if (!order) {
      return fail(res, 404, "ORDER_NOT_FOUND", "Order not found.");
    }

    return ok(res, serializeAdminOrderDetail(order));
  }
);

ordersRouter.get(
  "/site/notary/overview",
  requireAuthenticatedActor,
  async (req, res) => {
    if (req.actor.type !== "user" || req.actor.role !== "Notary") {
      return fail(res, 403, "FORBIDDEN", "Only notary users can access this overview.");
    }

    const notaryOrders = await OrderModel.find({ notaryId: req.actor.id })
      .sort({ createdAt: -1 })
      .lean();

    const pendingAcceptance = notaryOrders.filter((order) => order.status === "Notary Assigned");
    const acceptedOrders = notaryOrders.filter((order) => order.status === "Accepted By Notary");
    const inProgressOrders = notaryOrders.filter((order) => order.status === "In Progress");
    const completedOrders = notaryOrders.filter((order) => order.status === "Completed");

    return ok(res, {
      stats: [
        { label: "Completed Total Assignments", value: String(completedOrders.length) },
        {
          label: "Open Assignments",
          value: String(pendingAcceptance.length + acceptedOrders.length + inProgressOrders.length),
        },
        {
          label: "Total Earnings",
          value: `$${completedOrders.reduce((total, order) => total + Number(order.notaryOfferAmount ?? order.feeAmount ?? 0), 0).toFixed(2)}`,
        },
      ],
      assignments: [...acceptedOrders, ...inProgressOrders]
        .slice(0, 6)
        .map((order) => ({
          time: order.signingTime,
          name: order.signerName,
          detail: order.serviceType,
          status: order.status,
        })),
      requests: pendingAcceptance.map(serializeNotaryAssignment),
      assignmentOrderStats: [
        { label: "Total", value: String(notaryOrders.length), sub: "Assigned orders" },
        { label: "Pending", value: String(pendingAcceptance.length), sub: "Awaiting acceptance" },
        { label: "In Progress", value: String(inProgressOrders.length), sub: "Currently active" },
        { label: "Completed", value: String(completedOrders.length), sub: "Successfully signed" },
      ],
      assignmentOrders: notaryOrders.map(serializeNotaryAssignment),
    });
  }
);

ordersRouter.get(
  "/site/notary/assignments",
  requireAuthenticatedActor,
  validate(listOrdersSchema),
  async (req, res) => {
    if (req.actor.type !== "user" || req.actor.role !== "Notary") {
      return fail(res, 403, "FORBIDDEN", "Only notary users can access assignments.");
    }

    const query = {
      notaryId: req.actor.id,
      ...buildOrderSearchQuery(req.query),
    };
    const orders = await OrderModel.find(query).sort({ createdAt: -1 }).lean();
    return ok(res, orders.map(serializeNotaryAssignment));
  }
);

ordersRouter.get(
  "/site/notary/assignments/:id",
  requireAuthenticatedActor,
  validate(orderIdParamsSchema),
  async (req, res) => {
    if (req.actor.type !== "user" || req.actor.role !== "Notary") {
      return fail(res, 403, "FORBIDDEN", "Only notary users can access assignments.");
    }

    const order = await findNotaryOrderById(req.params.id, req.actor.id).lean();
    if (!order) {
      return fail(res, 404, "ORDER_NOT_FOUND", "Assignment not found.");
    }

    return ok(res, serializeNotaryAssignmentDetail(order));
  }
);

ordersRouter.patch(
  "/site/notary/orders/:id/accept",
  requireAuthenticatedActor,
  validate(notaryActionSchema),
  async (req, res) => {
    if (req.actor.type !== "user" || req.actor.role !== "Notary") {
      return fail(res, 403, "FORBIDDEN", "Only notary users can accept assignments.");
    }

    const current = await findNotaryOrderById(req.params.id, req.actor.id).lean();
    if (!current) {
      return fail(res, 404, "ORDER_NOT_FOUND", "Assignment not found.");
    }
    if (current.status !== "Notary Assigned") {
      return fail(res, 400, "INVALID_STATUS", "Only newly assigned orders can be accepted.");
    }

    const updated = await updateOrderStatus({
      id: req.params.id,
      status: "Accepted By Notary",
      actor: req.actor,
      note: req.body.note || "Assignment accepted by notary.",
    });

    await syncPaymentFromOrder(updated);
    emitOrderStatusUpdated(updated, {
      previousStatus: current.status,
      changedBy: req.actor.id,
    });
    emitAssignmentUpdated(updated, {
      previousStatus: current.status,
      changedBy: req.actor.id,
      event: "accepted",
    });
    await notifyAdmins({
      title: "Notary accepted assignment",
      meta: `${updated.id} · ${req.actor.record.name}`,
      action: "View Order",
      entityId: updated.id,
    });
    await createAuditLog({
      action: "order.notary_accepted",
      entityType: "order",
      entityId: updated.id,
      title: "Notary accepted assignment",
      summary: `${req.actor.record.name} accepted ${updated.id}.`,
      actor: req.actor,
    });

    return ok(res, serializeAdminOrderDetail(updated), "Assignment accepted successfully.");
  }
);

ordersRouter.patch(
  "/site/notary/orders/:id/reject",
  requireAuthenticatedActor,
  validate(notaryRejectSchema),
  async (req, res) => {
    if (req.actor.type !== "user" || req.actor.role !== "Notary") {
      return fail(res, 403, "FORBIDDEN", "Only notary users can reject assignments.");
    }

    const current = await findNotaryOrderById(req.params.id, req.actor.id).lean();
    if (!current) {
      return fail(res, 404, "ORDER_NOT_FOUND", "Assignment not found.");
    }
    if (assertTransitionOrFail(res, current.status, "Rejected By Notary")) {
      return;
    }

    const rejected = await updateOrderStatus({
      id: req.params.id,
      status: "Rejected By Notary",
      actor: req.actor,
      note: req.body.reason,
    });

    const reassignmentReady = await updateOrderStatus({
      id: req.params.id,
      status: "Needs Reassignment",
      actor: req.actor,
      note: "Order returned to admin for reassignment.",
      extraSet: {
        notaryId: null,
        notary: "Unassigned",
      },
    });

    await syncPaymentFromOrder(reassignmentReady);
    emitOrderStatusUpdated(reassignmentReady, {
      previousStatus: current.status,
      changedBy: req.actor.id,
    });
    emitAssignmentUpdated(reassignmentReady, {
      previousStatus: current.status,
      changedBy: req.actor.id,
      event: "rejected",
    });
    await notifyAdmins({
      title: "Notary rejected assignment",
      meta: `${rejected.id} · ${req.actor.record.name}`,
      action: "Reassign Order",
      entityId: rejected.id,
    });
    await createAuditLog({
      action: "order.notary_rejected",
      entityType: "order",
      entityId: rejected.id,
      title: "Notary rejected assignment",
      summary: `${req.actor.record.name} rejected ${rejected.id}.`,
      actor: req.actor,
      metadata: { reason: req.body.reason },
    });

    return ok(res, serializeAdminOrderDetail(reassignmentReady), "Assignment rejected successfully.");
  }
);

ordersRouter.patch(
  "/site/notary/orders/:id/start",
  requireAuthenticatedActor,
  validate(notaryActionSchema),
  async (req, res) => {
    if (req.actor.type !== "user" || req.actor.role !== "Notary") {
      return fail(res, 403, "FORBIDDEN", "Only notary users can start assignments.");
    }

    const current = await findNotaryOrderById(req.params.id, req.actor.id).lean();
    if (!current) {
      return fail(res, 404, "ORDER_NOT_FOUND", "Assignment not found.");
    }
    if (assertTransitionOrFail(res, current.status, "In Progress")) {
      return;
    }

    const updated = await updateOrderStatus({
      id: req.params.id,
      status: "In Progress",
      actor: req.actor,
      note: req.body.note || "Signing started by notary.",
    });

    await syncPaymentFromOrder(updated);
    emitOrderStatusUpdated(updated, {
      previousStatus: current.status,
      changedBy: req.actor.id,
    });
    emitAssignmentUpdated(updated, {
      previousStatus: current.status,
      changedBy: req.actor.id,
      event: "started",
    });
    return ok(res, serializeAdminOrderDetail(updated), "Order started successfully.");
  }
);

ordersRouter.patch(
  "/site/notary/orders/:id/complete",
  requireAuthenticatedActor,
  validate(notaryActionSchema),
  async (req, res) => {
    if (req.actor.type !== "user" || req.actor.role !== "Notary") {
      return fail(res, 403, "FORBIDDEN", "Only notary users can complete assignments.");
    }

    const current = await findNotaryOrderById(req.params.id, req.actor.id).lean();
    if (!current) {
      return fail(res, 404, "ORDER_NOT_FOUND", "Assignment not found.");
    }
    if (assertTransitionOrFail(res, current.status, "Completed")) {
      return;
    }
    if (requiresCompletedDocumentsForCompletion(current)) {
      return fail(
        res,
        400,
        "COMPLETED_DOCUMENTS_REQUIRED",
        "Upload at least one completed document before marking the order complete."
      );
    }

    const updated = await updateOrderStatus({
      id: req.params.id,
      status: "Completed",
      actor: req.actor,
      note: req.body.note || "Order completed by notary.",
      extraSet: {
        payoutDueDate: buildPayoutDueDate(current.payoutReleaseDays || 0),
      },
    });

    emitOrderStatusUpdated(updated, {
      previousStatus: current.status,
      changedBy: req.actor.id,
    });
    emitAssignmentUpdated(updated, {
      previousStatus: current.status,
      changedBy: req.actor.id,
      event: "completed",
    });
    await notifyAdmins({
      title: "Order completed by notary",
      meta: `${updated.id} is ready for review`,
      action: "Review Completion",
      entityId: updated.id,
    });
    await notifySpecificUser({
      title: "Your order is complete",
      meta: `${updated.id} has been completed`,
      action: "View Order",
      userId: updated.clientUserId,
      entityId: updated.id,
    });
    await queueEmail({
      to: updated.clientEmail,
      subject: "Your Notarix order is complete",
      text: `Hello, your order ${updated.id} has been completed.`,
      html: `<p>Hello,</p><p>Your order <strong>${updated.id}</strong> has been completed.</p>`,
      category: "order-completed",
    });

    await syncPaymentFromOrder(updated);
    await createAuditLog({
      action: "order.completed",
      entityType: "order",
      entityId: updated.id,
      title: "Order completed",
      summary: `${updated.id} marked completed by notary.`,
      actor: req.actor,
    });

    return ok(res, serializeAdminOrderDetail(updated), "Order completed successfully.");
  }
);

ordersRouter.get(
  "/admin/orders",
  requireAdminAuth,
  validate(listOrdersSchema),
  async (req, res) => {
    const query = buildOrderSearchQuery(req.query);
    const { page, pageSize, skip } = parsePaginationQuery(req.query);
    const [totalItems, orders] = await Promise.all([
      OrderModel.countDocuments(query),
      OrderModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    ]);

    return ok(res, {
      items: orders.map(serializeAdminOrder),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    });
  }
);

// Create an order on behalf of a client (admin-authenticated).
// `clientUserId` identifies the client; everything else matches the
// `/site/orders` shape so the form on the admin dashboard mirrors the
// notarix-site client order form.
const adminOrderCreateSchema = z.object({
  body: orderCreateSchema.shape.body.extend({
    clientUserId: z.string().min(1),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

ordersRouter.post(
  "/admin/orders",
  requireAdminAuth,
  validate(adminOrderCreateSchema),
  async (req, res) => {
    const clientUserId = String(req.body.clientUserId || "").trim();
    const client = await UserModel.findOne({ id: clientUserId, role: "Client" }).lean();
    if (!client) {
      return fail(res, 404, "CLIENT_NOT_FOUND", "Client not found.");
    }

    const signerName = `${req.body.signerFirstName} ${req.body.signerLastName}`.trim();
    const orderId = `${req.body.isRon ? "RON" : "ORD"}-${Date.now()}`;
    const initialStatus = "Pending Admin Review";

    const order = await OrderModel.create({
      id: orderId,
      clientUserId: client.id,
      clientEmail: client.email,
      clientName: client.primaryContact?.name || client.name || client.email,
      clientCompany: client.organization?.companyName || client.company || "",
      vendorCode: req.body.vendorCode,
      serviceType: req.body.serviceType,
      signerFirstName: req.body.signerFirstName,
      signerLastName: req.body.signerLastName,
      signerName,
      signerPhone: req.body.signerPhone,
      signerEmail: req.body.signerEmail,
      hasSecondarySigner: Boolean(req.body.hasSecondarySigner),
      propertyAddress: req.body.propertyAddress,
      signingDate: req.body.signingDate,
      signingTime: req.body.signingTime,
      feeAmount: req.body.feeAmount,
      paymentStatus: req.body.paymentStatus || "Pending",
      paymentMethod: req.body.paymentMethod || "",
      dueDate: req.body.dueDate || "",
      paidDate: req.body.paidDate || "",
      paymentNotes: req.body.paymentNotes || "",
      paperSize: req.body.paperSize || "Letter",
      preferredInk: req.body.preferredInk || "Black",
      estimatedPages: req.body.estimatedPages || "",
      isRon: Boolean(req.body.isRon),
      specialInstructions: req.body.specialInstructions || "",
      status: initialStatus,
      notary: "Unassigned",
      documents: [],
      statusHistory: [
        createStatusHistoryEntry(
          initialStatus,
          { id: req.admin.id, role: "admin" },
          "Order created by admin on behalf of client."
        ),
      ],
    });

    await syncPaymentFromOrder(order.toObject());
    emitOrderStatusUpdated(order.toObject(), {
      previousStatus: null,
      changedBy: req.admin.id,
      event: "created",
    });
    await createAuditLog({
      action: "order.created",
      entityType: "order",
      entityId: order.id,
      title: "Order created by admin",
      summary: `${req.admin.name || req.admin.email} created an order for ${
        order.clientCompany || order.clientName
      }.`,
      actor: { id: req.admin.id, type: "admin", record: req.admin },
      metadata: { serviceType: order.serviceType, feeAmount: order.feeAmount, clientUserId: client.id },
    });

    const reloaded = await OrderModel.findOne({ id: order.id }).lean();
    return ok(
      res,
      { orderId: order.id, order: serializeAdminOrder(reloaded) },
      "Order created successfully.",
      201
    );
  }
);

ordersRouter.get(
  "/admin/orders/:id",
  requireAdminAuth,
  validate(orderIdParamsSchema),
  async (req, res) => {
    const order = await findOrderById(req.params.id).lean();
    if (!order) {
      return fail(res, 404, "ORDER_NOT_FOUND", "Order not found.");
    }
    return ok(res, serializeAdminOrderDetail(order));
  }
);

ordersRouter.patch(
  "/admin/orders/:id/accept",
  requireAdminAuth,
  validate(orderIdParamsSchema),
  async (req, res) => {
    const current = await findOrderById(req.params.id).lean();
    if (!current) {
      return fail(res, 404, "ORDER_NOT_FOUND", "Order not found.");
    }
    if (assertTransitionOrFail(res, current.status, "Accepted By Admin")) {
      return;
    }
    if (
      assertVerifiedOrderDocuments(
        res,
        current,
        "All client-uploaded order documents must be verified before accepting the order."
      )
    ) {
      return;
    }

    const updated = await updateOrderStatus({
      id: req.params.id,
      status: "Accepted By Admin",
      actor: req.admin,
      note: "Order accepted by admin.",
      extraSet: { adminReviewReason: "" },
    });

    await syncPaymentFromOrder(updated);
    emitOrderStatusUpdated(updated, {
      previousStatus: current.status,
      changedBy: req.admin.id,
    });
    await queueEmail({
      to: updated.clientEmail,
      subject: "Your Notarix order was accepted",
      text: `Hello, your order ${updated.id} has been accepted and is ready for notary assignment.`,
      html: `<p>Hello,</p><p>Your order <strong>${updated.id}</strong> has been accepted and is ready for notary assignment.</p>`,
      category: "order-accepted",
    });
    await notifySpecificUser({
      title: "Your order was accepted",
      meta: `${updated.id} is ready for notary assignment`,
      action: "View Order",
      userId: updated.clientUserId,
      entityId: updated.id,
    });
    await createAuditLog({
      action: "order.accepted",
      entityType: "order",
      entityId: updated.id,
      title: "Order accepted",
      summary: `${updated.id} accepted by admin.`,
      actor: req.admin,
    });

    return ok(res, serializeAdminOrderDetail(updated), "Order accepted successfully.");
  }
);

ordersRouter.patch(
  "/admin/orders/:id/reject",
  requireAdminAuth,
  validate(rejectOrderSchema),
  async (req, res) => {
    const current = await findOrderById(req.params.id).lean();
    if (!current) {
      return fail(res, 404, "ORDER_NOT_FOUND", "Order not found.");
    }
    if (assertTransitionOrFail(res, current.status, "Rejected By Admin")) {
      return;
    }

    const updated = await updateOrderStatus({
      id: req.params.id,
      status: "Rejected By Admin",
      actor: req.admin,
      note: req.body.reason,
      extraSet: {
        adminReviewReason: req.body.reason,
        notary: "Unassigned",
        notaryId: null,
      },
    });

    await syncPaymentFromOrder(updated);
    emitOrderStatusUpdated(updated, {
      previousStatus: current.status,
      changedBy: req.admin.id,
    });
    emitAssignmentUpdated(updated, {
      previousStatus: current.status,
      changedBy: req.admin.id,
      event: "rejected",
    });
    await queueEmail({
      to: updated.clientEmail,
      subject: "Your Notarix order was rejected",
      text: `Hello, your order ${updated.id} was rejected. Reason: ${req.body.reason}`,
      html: `<p>Hello,</p><p>Your order <strong>${updated.id}</strong> was rejected.</p><p>Reason: ${req.body.reason}</p>`,
      category: "order-rejected",
    });
    await notifySpecificUser({
      title: "Your order was rejected",
      meta: `${updated.id} was rejected`,
      action: "View Order",
      userId: updated.clientUserId,
      entityId: updated.id,
    });
    await createAuditLog({
      action: "order.rejected",
      entityType: "order",
      entityId: updated.id,
      title: "Order rejected",
      summary: `${updated.id} rejected by admin.`,
      actor: req.admin,
      metadata: { reason: req.body.reason },
    });

    return ok(res, serializeAdminOrderDetail(updated), "Order rejected successfully.");
  }
);

ordersRouter.get(
  "/admin/orders/:id/eligible-notaries",
  requireAdminAuth,
  validate(orderIdParamsSchema),
  async (req, res) => {
    const order = await findOrderById(req.params.id).lean();
    if (!order) {
      return fail(res, 404, "ORDER_NOT_FOUND", "Order not found.");
    }

    const areaRegex = order.propertyAddress?.state
      ? new RegExp(order.propertyAddress.state, "i")
      : null;

    const notaries = await UserModel.find({
      role: "Notary",
      status: { $ne: "Suspended" },
      ...(order.isRon ? { ronEligible: true } : {}),
    })
      .sort({ createdAt: -1 })
      .lean();

    const eligible = notaries
      .filter((notary) => {
        if (!areaRegex) return true;
        const coverage = String(notary.commission?.coverageAreas || "");
        return areaRegex.test(notary.area || "") || areaRegex.test(coverage);
      })
      .map((notary) => ({
        id: notary.id,
        name: notary.name,
        email: notary.email,
        phone: notary.personalInfo?.phone || "",
        location: notary.area || notary.address?.state || "Coverage unknown",
        radius: notary.commission?.travelRadius || "Not specified",
        status: notary.status || "Pending",
        jobs: `${notary.requiredDocuments?.filter((item) => item.status === "Verified").length || 0} verified documents`,
        tags: [
          ...(notary.ronEligible ? ["RON"] : []),
          ...((notary.specialties || []).filter(Boolean)),
        ].slice(0, 3),
        avatarTone: notary.avatarTone || "bg-slate-200 text-slate-700",
      }));

    return ok(res, eligible);
  }
);

ordersRouter.patch(
  "/admin/orders/:id/assign-notary",
  requireAdminAuth,
  validate(assignNotarySchema),
  async (req, res) => {
    const current = await findOrderById(req.params.id).lean();
    if (!current) {
      return fail(res, 404, "ORDER_NOT_FOUND", "Order not found.");
    }
    if (assertTransitionOrFail(res, current.status, "Notary Assigned")) {
      return;
    }
    if (
      assertVerifiedOrderDocuments(
        res,
        current,
        "All client-uploaded order documents must be verified before assigning a notary."
      )
    ) {
      return;
    }

    const notary = await UserModel.findOne({
      id: req.body.notaryId,
      role: "Notary",
    }).lean();

    if (!notary) {
      return fail(res, 404, "NOTARY_NOT_FOUND", "Notary not found.");
    }
    if (notary.status === "Suspended") {
      return fail(res, 400, "NOTARY_UNAVAILABLE", "Suspended notaries cannot be assigned.");
    }

    const updated = await updateOrderStatus({
      id: req.params.id,
      status: "Notary Assigned",
      actor: req.admin,
      note: `Assigned to ${notary.name}.`,
      extraSet: {
        notaryId: notary.id,
        notary: notary.name,
        notaryOfferAmount:
          typeof req.body.notaryOfferAmount === "number"
            ? req.body.notaryOfferAmount
            : null,
        payoutReleaseDays:
          typeof req.body.payoutReleaseDays === "number"
            ? req.body.payoutReleaseDays
            : null,
        assignmentNotes: req.body.assignmentNotes || "",
        adminReviewReason: "",
      },
    });

    const client = await UserModel.findOne({ id: updated.clientUserId }).lean();
    await ensureOrderConversation({
      order: updated,
      admin: { id: req.admin.id, type: "admin", role: req.admin.role, record: req.admin },
      client: client ? { id: client.id, type: "user", role: client.role, record: client } : null,
      notary: { id: notary.id, type: "user", role: notary.role, record: notary },
    });

    await notifyUserAudience({
      title: "New assignment received",
      meta: `${updated.id} assigned to ${notary.name}`,
      action: "Review Assignment",
      audience: "notary",
      recipientId: notary.id,
      recipientType: "user",
      entityId: updated.id,
    });
    await notifySpecificUser({
      title: "Your order was assigned",
      meta: `${updated.id} has been assigned to a notary`,
      action: "View Order",
      userId: updated.clientUserId,
      entityId: updated.id,
    });
    await queueEmail({
      to: notary.email,
      subject: "You have a new Notarix assignment",
      text: `Hello ${notary.name}, order ${updated.id} has been assigned to you.`,
      html: `<p>Hello ${notary.name},</p><p>Order <strong>${updated.id}</strong> has been assigned to you.</p>`,
      category: "notary-assignment",
    });

    await syncPaymentFromOrder(updated, { notaryEmail: notary.email });
    emitOrderStatusUpdated(updated, {
      previousStatus: current.status,
      changedBy: req.admin.id,
    });
    emitAssignmentUpdated(updated, {
      previousStatus: current.status,
      changedBy: req.admin.id,
      event: "assigned",
    });
    await createAuditLog({
      action: "order.notary_assigned",
      entityType: "order",
      entityId: updated.id,
      title: "Notary assigned",
      summary: `${notary.name} assigned to ${updated.id}.`,
      actor: req.admin,
      metadata: { notaryId: notary.id, notaryName: notary.name },
    });

    return ok(res, serializeAdminOrderDetail(updated), "Notary assigned successfully.");
  }
);

ordersRouter.patch(
  "/admin/orders/:id/reassign-notary",
  requireAdminAuth,
  validate(assignNotarySchema),
  async (req, res) => {
    const current = await findOrderById(req.params.id).lean();
    if (!current) {
      return fail(res, 404, "ORDER_NOT_FOUND", "Order not found.");
    }
    if (current.status !== "Needs Reassignment") {
      return fail(
        res,
        400,
        "INVALID_STATUS",
        'Only orders in status "Needs Reassignment" can be reassigned.'
      );
    }

    const notary = await UserModel.findOne({
      id: req.body.notaryId,
      role: "Notary",
    }).lean();

    if (!notary) {
      return fail(res, 404, "NOTARY_NOT_FOUND", "Notary not found.");
    }
    if (notary.status === "Suspended") {
      return fail(res, 400, "NOTARY_UNAVAILABLE", "Suspended notaries cannot be assigned.");
    }

    const updated = await updateOrderStatus({
      id: req.params.id,
      status: "Needs Reassignment",
      actor: req.admin,
      note: `Reassignment initiated to ${notary.name}.`,
      extraSet: {
        notaryId: notary.id,
        notary: notary.name,
        notaryOfferAmount:
          typeof req.body.notaryOfferAmount === "number"
            ? req.body.notaryOfferAmount
            : null,
        payoutReleaseDays:
          typeof req.body.payoutReleaseDays === "number"
            ? req.body.payoutReleaseDays
            : null,
        assignmentNotes: req.body.assignmentNotes || "",
      },
    });

    const assigned = await updateOrderStatus({
      id: req.params.id,
      status: "Notary Assigned",
      actor: req.admin,
      note: `Reassigned to ${notary.name}.`,
    });

    const client = await UserModel.findOne({ id: (assigned || updated).clientUserId }).lean();
    await ensureOrderConversation({
      order: assigned || updated,
      admin: { id: req.admin.id, type: "admin", role: req.admin.role, record: req.admin },
      client: client ? { id: client.id, type: "user", role: client.role, record: client } : null,
      notary: { id: notary.id, type: "user", role: notary.role, record: notary },
    });

    await notifyUserAudience({
      title: "New reassigned order",
      meta: `${updated.id} reassigned to ${notary.name}`,
      action: "Review Assignment",
      audience: "notary",
      recipientId: notary.id,
      recipientType: "user",
      entityId: updated.id,
    });
    await queueEmail({
      to: notary.email,
      subject: "A Notarix order was reassigned to you",
      text: `Hello ${notary.name}, order ${updated.id} has been reassigned to you.`,
      html: `<p>Hello ${notary.name},</p><p>Order <strong>${updated.id}</strong> has been reassigned to you.</p>`,
      category: "notary-reassignment",
    });

    await syncPaymentFromOrder(assigned || updated, { notaryEmail: notary.email });
    emitOrderStatusUpdated(assigned || updated, {
      previousStatus: current.status,
      changedBy: req.admin.id,
    });
    emitAssignmentUpdated(assigned || updated, {
      previousStatus: current.status,
      changedBy: req.admin.id,
      event: "reassigned",
    });
    await createAuditLog({
      action: "order.notary_reassigned",
      entityType: "order",
      entityId: (assigned || updated).id,
      title: "Notary reassigned",
      summary: `${notary.name} reassigned to ${(assigned || updated).id}.`,
      actor: req.admin,
      metadata: { notaryId: notary.id, notaryName: notary.name },
    });

    return ok(
      res,
      serializeAdminOrderDetail(assigned || updated),
      "Notary reassigned successfully."
    );
  }
);

ordersRouter.patch(
  "/admin/orders/:id/status",
  requireAdminAuth,
  validate(orderStatusSchema),
  async (req, res) => {
    const current = await findOrderById(req.params.id).lean();
    if (!current) {
      return fail(res, 404, "ORDER_NOT_FOUND", "Order not found.");
    }
    if (!canTransitionOrderStatus(current.status, req.body.status)) {
      return fail(
        res,
        400,
        "INVALID_STATUS",
        getOrderTransitionError(current.status, req.body.status)
      );
    }
    if (
      ["Notary Assigned", "Accepted By Notary", "In Progress", "Completed"].includes(
        req.body.status
      ) &&
      !current.notaryId
    ) {
      return fail(
        res,
        400,
        "NOTARY_REQUIRED",
        "This status requires an assigned notary before it can be applied."
      );
    }
    if (
      req.body.status === "Completed" &&
      requiresCompletedDocumentsForCompletion(current)
    ) {
      return fail(
        res,
        400,
        "COMPLETED_DOCUMENTS_REQUIRED",
        "Upload at least one completed document before marking the order complete."
      );
    }

    const extraSet = {};
    if (req.body.status === "Cancelled") {
      extraSet.notaryId = null;
      extraSet.notary = "Unassigned";
    }
    if (req.body.status === "Completed") {
      extraSet.payoutDueDate = buildPayoutDueDate(current.payoutReleaseDays || 0);
    }
    if (req.body.status === "Needs Reassignment") {
      extraSet.notaryId = null;
      extraSet.notary = "Unassigned";
    }

    const updated = await updateOrderStatus({
      id: req.params.id,
      status: req.body.status,
      actor: req.admin,
      note: req.body.note || `Order marked as ${req.body.status}.`,
      extraSet,
    });

    await syncPaymentFromOrder(updated);
    emitOrderStatusUpdated(updated, {
      previousStatus: current.status,
      changedBy: req.admin.id,
    });
    if (updated.notaryId || current.notaryId) {
      emitAssignmentUpdated(updated, {
        previousStatus: current.status,
        changedBy: req.admin.id,
        event: "status-updated",
      });
    }
    await notifySpecificUser({
      title: "Order status updated",
      meta: `${updated.id} is now ${req.body.status}`,
      action: "View Order",
      userId: updated.clientUserId,
      entityId: updated.id,
    });
    await createAuditLog({
      action: "order.status_updated",
      entityType: "order",
      entityId: updated.id,
      title: "Order status updated",
      summary: `${updated.id} moved from ${current.status} to ${updated.status}.`,
      actor: req.admin,
      metadata: {
        fromStatus: current.status,
        toStatus: updated.status,
      },
    });

    return ok(res, serializeAdminOrderDetail(updated), "Order status updated.");
  }
);

ordersRouter.post(
  "/site/notary/orders/:id/completed-documents",
  requireAuthenticatedActor,
  upload.array("documents", 10),
  async (req, res) => {
    if (req.actor.type !== "user" || req.actor.role !== "Notary") {
      return fail(res, 403, "FORBIDDEN", "Only notary users can upload completed documents.");
    }

    const current = await findNotaryOrderById(req.params.id, req.actor.id).lean();
    if (!current) {
      return fail(res, 404, "ORDER_NOT_FOUND", "Assignment not found.");
    }
    if (!["In Progress", "Completed"].includes(current.status)) {
      return fail(
        res,
        400,
        "INVALID_STATUS",
        "Completed documents can only be uploaded for in-progress or completed orders."
      );
    }

    const files = await Promise.all(
      (req.files || []).map(async (file) => {
        const stored = await storeUploadedFile(file, {
          folder: "notarix/orders/completed-documents",
        });
        return {
          id: `doc-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
          name: file.originalname,
          provider: stored.provider,
          file: stored.file,
          url: stored.url,
          mimeType: stored.mimeType,
          size: stored.size,
          uploadedAt: new Date(),
        };
      })
    );

    const updated = await appendOrderDocuments({
      orderId: req.params.id,
      field: "completedDocuments",
      files,
    });

    return ok(
      res,
      (updated.completedDocuments || []).map((document) => {
        const isHostedOnCloudinary = typeof document.url === "string" && document.url.startsWith("http");
        const cloudinaryUrl = isHostedOnCloudinary
      ? normalizeCloudinaryUrl(document.url, document.mimeType, { sign: true })
      : null;
        const fallbackView = document.file
          ? `/api/v1/files/orders/${updated.id}/completed-documents/${document.id}?mode=view`
          : null;
        const fallbackDownload = document.file
          ? `/api/v1/files/orders/${updated.id}/completed-documents/${document.id}?mode=download`
          : null;
        return {
          id: document.id,
          name: document.name,
          url: fallbackView || cloudinaryUrl,
          downloadUrl: fallbackDownload || cloudinaryUrl,
          mimeType: document.mimeType || null,
          size: document.size || null,
          uploadedAt: document.uploadedAt || null,
        };
      }),
      "Completed documents uploaded successfully.",
      201
    );
  }
);

ordersRouter.post(
  "/site/orders/:id/documents",
  requireAuthenticatedActor,
  upload.array("documents", 10),
  async (req, res) => {
    if (req.actor.type !== "user" || req.actor.role !== "Client") {
      return fail(res, 403, "FORBIDDEN", "Only client users can upload order documents.");
    }

    const nextDocuments = await Promise.all(
      (req.files || []).map(async (file) => {
        const stored = await storeUploadedFile(file, {
          folder: "notarix/orders/documents",
        });
        return {
          id: `doc-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
          name: file.originalname,
          status: "Pending",
          reviewNote: "",
          provider: stored.provider,
          file: stored.file,
          url: stored.url,
          mimeType: stored.mimeType,
          size: stored.size,
          uploadedAt: new Date(),
        };
      })
    );

    const updated = await OrderModel.findOneAndUpdate(
      { id: normalizeId(req.params.id), clientUserId: req.actor.id },
      {
        $push: {
          documents: { $each: nextDocuments },
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return fail(res, 404, "ORDER_NOT_FOUND", "Order not found.");
    }

    return ok(
      res,
      (updated.documents || []).map((document) => {
        const isHostedOnCloudinary = typeof document.url === "string" && document.url.startsWith("http");
        const cloudinaryUrl = isHostedOnCloudinary
      ? normalizeCloudinaryUrl(document.url, document.mimeType, { sign: true })
      : null;
        const fallbackView = document.file
          ? `/api/v1/files/orders/${updated.id}/documents/${document.id}?mode=view`
          : null;
        const fallbackDownload = document.file
          ? `/api/v1/files/orders/${updated.id}/documents/${document.id}?mode=download`
          : null;
        return {
          id: document.id,
          name: document.name,
          status: document.status || "Pending",
          reviewNote: document.reviewNote || "",
          url: fallbackView || cloudinaryUrl,
          downloadUrl: fallbackDownload || cloudinaryUrl,
          mimeType: document.mimeType || null,
          size: document.size || null,
          uploadedAt: document.uploadedAt || null,
        };
      }),
      "Order documents uploaded successfully.",
      201
    );
  }
);

// Replace an existing document on a client order. Useful for re-uploading a
// document whose original Cloudinary asset was lost or made private.
ordersRouter.put(
  "/site/orders/:id/documents/:documentId",
  requireAuthenticatedActor,
  upload.single("document"),
  async (req, res) => {
    if (req.actor.type !== "user" || req.actor.role !== "Client") {
      return fail(res, 403, "FORBIDDEN", "Only client users can replace order documents.");
    }
    if (!req.file) {
      return fail(res, 400, "FILE_REQUIRED", "No document file uploaded.");
    }

    const order = await OrderModel.findOne({
      id: normalizeId(req.params.id),
      clientUserId: req.actor.id,
    }).lean();
    if (!order) {
      return fail(res, 404, "ORDER_NOT_FOUND", "Order not found.");
    }

    const existing = (order.documents || []).find((item) => item.id === req.params.documentId);
    if (!existing) {
      return fail(res, 404, "DOCUMENT_NOT_FOUND", "Order document not found.");
    }

    const stored = await storeUploadedFile(req.file, {
      folder: "notarix/orders/documents",
    });

    const updated = await OrderModel.findOneAndUpdate(
      {
        id: order.id,
        "documents.id": req.params.documentId,
      },
      {
        $set: {
          "documents.$.name": req.file.originalname,
          "documents.$.status": "Pending",
          "documents.$.reviewNote": "",
          "documents.$.provider": stored.provider,
          "documents.$.file": stored.file,
          "documents.$.url": stored.url,
          "documents.$.mimeType": stored.mimeType,
          "documents.$.size": stored.size,
          "documents.$.uploadedAt": new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return fail(res, 500, "UPDATE_FAILED", "Unable to replace document.");
    }

    const replaced = (updated.documents || []).find(
      (item) => item.id === req.params.documentId
    );

    if (!replaced) {
      return fail(res, 500, "UPDATE_FAILED", "Document missing after replacement.");
    }

    const isHostedOnCloudinary =
      typeof replaced.url === "string" && replaced.url.startsWith("http");
    const cloudinaryUrl = isHostedOnCloudinary
      ? normalizeCloudinaryUrl(replaced.url, replaced.mimeType, { sign: true })
      : null;
    const fallbackView = replaced.file
      ? `/api/v1/files/orders/${updated.id}/documents/${replaced.id}?mode=view`
      : null;
    const fallbackDownload = replaced.file
      ? `/api/v1/files/orders/${updated.id}/documents/${replaced.id}?mode=download`
      : null;

    return ok(
      res,
      {
        id: replaced.id,
        name: replaced.name,
        status: replaced.status || "Pending",
        reviewNote: replaced.reviewNote || "",
        url: fallbackView || cloudinaryUrl,
        downloadUrl: fallbackDownload || cloudinaryUrl,
        mimeType: replaced.mimeType || null,
        size: replaced.size || null,
        uploadedAt: replaced.uploadedAt || null,
      },
      "Document replaced successfully.",
      200
    );
  }
);

ordersRouter.patch(
  "/admin/orders/:id/documents/:documentId/status",
  requireAdminAuth,
  validate(orderDocumentStatusSchema),
  async (req, res) => {
    const order = await findOrderById(req.params.id).lean();
    if (!order) {
      return fail(res, 404, "ORDER_NOT_FOUND", "Order not found.");
    }

    const nextDocuments = [...(order.documents || [])];
    const document = nextDocuments.find((item) => item.id === req.params.documentId);

    if (!document) {
      return fail(res, 404, "DOCUMENT_NOT_FOUND", "Order document not found.");
    }

    document.status = req.body.status;
    document.reviewNote = req.body.reviewNote || "";

    const updated = await OrderModel.findOneAndUpdate(
      { id: order.id },
      { $set: { documents: nextDocuments } },
      { new: true }
    ).lean();

    await createAuditLog({
      action: "order.document_reviewed",
      entityType: "order",
      entityId: updated.id,
      title: "Order document reviewed",
      summary: `${document.name} marked as ${req.body.status}.`,
      actor: req.admin,
      metadata: {
        documentId: document.id,
        documentName: document.name,
        status: req.body.status,
        reviewNote: document.reviewNote || "",
      },
    });

    return ok(
      res,
      serializeAdminOrderDetail(updated),
      `Order document marked as ${req.body.status}.`
    );
  }
);
