import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import {
  requireAdminAuth,
  requireAuthenticatedActor,
} from "../../shared/http/auth-middleware.js";
import { fail, ok } from "../../shared/http/respond.js";
import { validate } from "../../shared/middleware/validate.js";
import { upload } from "../../shared/storage/upload.js";
import { OrderModel } from "./order.model.js";
import { UserModel } from "../users/user.model.js";

export const ordersRouter = Router();

const ORDER_STATUSES = [
  "Pending Admin Review",
  "Accepted By Admin",
  "Rejected By Admin",
  "Notary Assigned",
  "Accepted By Notary",
  "Rejected By Notary",
  "Needs Reassignment",
  "In Progress",
  "Completed",
  "Cancelled",
];

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

const normalizeId = (value) => String(value || "").replace(/^#/, "");

const serializeStatus = (status) => {
  switch (status) {
    case "Pending Admin Review":
    case "Accepted By Admin":
    case "Rejected By Admin":
    case "Needs Reassignment":
      return "Pending";
    case "Notary Assigned":
    case "Accepted By Notary":
      return "Assigned";
    default:
      return status;
  }
};

const buildOrderRoute = (order) => `/orders/${order.id}`;

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
  notary: order.notary || "Unassigned",
  notaryId: order.notaryId || null,
  status: serializeStatus(order.status),
  workflowStatus: order.status,
  type: order.isRon ? "RON" : "In-Person",
  fee: `$${Number(order.feeAmount || 0).toFixed(2)}`,
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
  documents: (order.documents || []).map((document) => ({
    id: document.id,
    name: document.name,
    url: document.file ? `/uploads/${document.file}` : null,
    mimeType: document.mimeType || null,
    size: document.size || null,
  })),
  timeline: buildTimeline(order),
});

const serializeClientOrder = (order) => ({
  id: `#${order.id}`,
  route: `/dashboard-client/orders/${order.id}`,
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
  "/admin/orders",
  requireAdminAuth,
  validate(listOrdersSchema),
  async (req, res) => {
    const orders = await OrderModel.find(buildOrderSearchQuery(req.query))
      .sort({ createdAt: -1 })
      .lean();
    return ok(res, orders.map(serializeAdminOrder));
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
    const updated = await updateOrderStatus({
      id: req.params.id,
      status: "Accepted By Admin",
      actor: req.admin,
      note: "Order accepted by admin.",
      extraSet: { adminReviewReason: "" },
    });

    if (!updated) {
      return fail(res, 404, "ORDER_NOT_FOUND", "Order not found.");
    }

    return ok(res, serializeAdminOrderDetail(updated), "Order accepted successfully.");
  }
);

ordersRouter.patch(
  "/admin/orders/:id/reject",
  requireAdminAuth,
  validate(rejectOrderSchema),
  async (req, res) => {
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

    if (!updated) {
      return fail(res, 404, "ORDER_NOT_FOUND", "Order not found.");
    }

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
    const notary = await UserModel.findOne({
      id: req.body.notaryId,
      role: "Notary",
    }).lean();

    if (!notary) {
      return fail(res, 404, "NOTARY_NOT_FOUND", "Notary not found.");
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

    if (!updated) {
      return fail(res, 404, "ORDER_NOT_FOUND", "Order not found.");
    }

    return ok(res, serializeAdminOrderDetail(updated), "Notary assigned successfully.");
  }
);

ordersRouter.patch(
  "/admin/orders/:id/reassign-notary",
  requireAdminAuth,
  validate(assignNotarySchema),
  async (req, res) => {
    const notary = await UserModel.findOne({
      id: req.body.notaryId,
      role: "Notary",
    }).lean();

    if (!notary) {
      return fail(res, 404, "NOTARY_NOT_FOUND", "Notary not found.");
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

    if (!updated) {
      return fail(res, 404, "ORDER_NOT_FOUND", "Order not found.");
    }

    const assigned = await updateOrderStatus({
      id: req.params.id,
      status: "Notary Assigned",
      actor: req.admin,
      note: `Reassigned to ${notary.name}.`,
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
    const updated = await updateOrderStatus({
      id: req.params.id,
      status: req.body.status,
      actor: req.admin,
      note: req.body.note || `Order marked as ${req.body.status}.`,
    });

    if (!updated) {
      return fail(res, 404, "ORDER_NOT_FOUND", "Order not found.");
    }

    return ok(res, serializeAdminOrderDetail(updated), "Order status updated.");
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

    const files = req.files || [];
    const nextDocuments = files.map((file) => ({
      id: `doc-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      name: file.originalname,
      file: file.filename,
      mimeType: file.mimetype,
      size: file.size,
    }));

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
      (updated.documents || []).map((document) => ({
        id: document.id,
        name: document.name,
        url: document.file ? `/uploads/${document.file}` : null,
        mimeType: document.mimeType || null,
        size: document.size || null,
      })),
      "Order documents uploaded successfully.",
      201
    );
  }
);
