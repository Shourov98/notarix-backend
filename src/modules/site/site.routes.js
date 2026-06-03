import { Router } from "express";
import { z } from "zod";
import {
  requireAdminAuth,
  requireAuthenticatedActor,
} from "../../shared/http/auth-middleware.js";
import { fail, ok } from "../../shared/http/respond.js";
import { validate } from "../../shared/middleware/validate.js";
import { upload } from "../../shared/storage/upload.js";
import {
  buildMaskedBankInfo,
  decryptBankInfo,
  encryptBankInfo,
} from "../../shared/security/bank-info.js";
import { UserModel } from "../users/user.model.js";
import { OrderModel } from "../orders/order.model.js";
import { PaymentModel } from "../payments/payment.model.js";

export const siteRouter = Router();

const siteBankInfoSchema = z.object({
  body: z.object({
    bankName: z.string().min(2),
    accountHolderName: z.string().min(2),
    accountType: z.enum(["checking", "savings", "business_checking"]),
    routingNumber: z.string().regex(/^\d{9}$/),
    accountNumber: z.string().regex(/^\d{6,17}$/),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

const siteProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(7).optional().or(z.literal("")),
    company: z.string().optional().or(z.literal("")),
    coverageAreas: z.string().optional().or(z.literal("")),
    address: z
      .object({
        line1: z.string().optional().or(z.literal("")),
        line2: z.string().optional().or(z.literal("")),
        city: z.string().optional().or(z.literal("")),
        state: z.string().optional().or(z.literal("")),
        zip: z.string().optional().or(z.literal("")),
      })
      .optional(),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

const trackedClientDocumentKeys = [
  "service-agreement",
  "w9-form",
  "eo-certificate",
  "business-license",
];

const trackedNotaryDocumentKeys = [
  "service-agreement",
  "billing-setup-form",
  "contact-confirmation",
  "w9-form",
  "business-license",
  "eo-certificate",
  "portal-access-authorization",
];

const clientProfileDetailsSchema = z.object({
  body: z.object({
    organization: z.object({
      companyName: z.string().min(2),
      website: z.string().optional().or(z.literal("")),
      companyType: z.string().optional().or(z.literal("")),
      officePhone: z.string().optional().or(z.literal("")),
    }),
    address: z.object({
      line1: z.string().optional().or(z.literal("")),
      line2: z.string().optional().or(z.literal("")),
      city: z.string().optional().or(z.literal("")),
      state: z.string().optional().or(z.literal("")),
      zip: z.string().optional().or(z.literal("")),
    }),
    primaryRepresentative: z.object({
      name: z.string().optional().or(z.literal("")),
      email: z.string().email().optional().or(z.literal("")),
      phone: z.string().optional().or(z.literal("")),
    }),
    secondaryRepresentative: z.object({
      name: z.string().optional().or(z.literal("")),
      email: z.string().email().optional().or(z.literal("")),
      phone: z.string().optional().or(z.literal("")),
    }),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

const clientTrackedDocumentSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    documentKey: z.enum(trackedClientDocumentKeys),
  }),
});

const notificationPreferencesSchema = z.object({
  body: z.object({
    emailNotifications: z.boolean(),
    orderUpdates: z.boolean(),
    paymentAlerts: z.boolean(),
    directMessages: z.boolean(),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

const notaryNotificationPreferencesSchema = z.object({
  body: z.object({
    emailNewOrderAssigned: z.boolean(),
    emailOrderStatusUpdates: z.boolean(),
    emailPaymentReceived: z.boolean(),
    inAppNewMessages: z.boolean(),
    inAppDocumentUploadUpdates: z.boolean(),
    inAppMeetingRequests: z.boolean(),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

const notaryProfileDetailsSchema = z.object({
  body: z.object({
    profile: z.object({
      name: z.string().min(2),
      email: z.string().email(),
      phone: z.string().optional().or(z.literal("")),
      coverageAreas: z.string().optional().or(z.literal("")),
    }),
    address: z.object({
      line1: z.string().optional().or(z.literal("")),
      line2: z.string().optional().or(z.literal("")),
      city: z.string().optional().or(z.literal("")),
      state: z.string().optional().or(z.literal("")),
      zip: z.string().optional().or(z.literal("")),
    }),
    commission: z.object({
      number: z.string().optional().or(z.literal("")),
      state: z.string().optional().or(z.literal("")),
      expirationDate: z.string().optional().or(z.literal("")),
      travelRadius: z.string().optional().or(z.literal("")),
      eoCoverageAmount: z.string().optional().or(z.literal("")),
    }),
    additional: z.object({
      ronApproval: z.enum(["approved", "pending", "not_requested"]).optional().or(z.literal("")),
      backgroundCheckDate: z.string().optional().or(z.literal("")),
      specialties: z.array(z.string()).optional(),
      secondaryContactName: z.string().optional().or(z.literal("")),
      secondaryContactEmail: z.string().email().optional().or(z.literal("")),
      secondaryContactPhone: z.string().optional().or(z.literal("")),
    }),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

const notaryTrackedDocumentSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    documentKey: z.enum(trackedNotaryDocumentKeys),
  }),
});

const serializePortalProfile = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  company: user.organization?.companyName || user.company || "",
  phone: user.primaryContact?.phone || user.personalInfo?.phone || "",
  status: user.status,
  verification: user.verification,
  avatar: user.avatar ? `/api/v1/files/users/${user.id}/avatar?mode=view` : null,
  ronEligible: Boolean(user.ronEligible),
  coverageAreas: user.commission?.coverageAreas || "",
  address: {
    line1: user.address?.line1 || "",
    line2: user.address?.line2 || "",
    city: user.address?.city || "",
    state: user.address?.state || "",
    zip: user.address?.zip || "",
  },
});

const serializeNotificationPreferences = (user) => ({
  emailNotifications: user.notificationPreferences?.emailNotifications ?? true,
  orderUpdates: user.notificationPreferences?.orderUpdates ?? true,
  paymentAlerts: user.notificationPreferences?.paymentAlerts ?? false,
  directMessages: user.notificationPreferences?.directMessages ?? true,
});

const serializeNotaryNotificationPreferences = (user) => ({
  emailNewOrderAssigned: user.notificationPreferences?.emailNewOrderAssigned ?? true,
  emailOrderStatusUpdates:
    user.notificationPreferences?.emailOrderStatusUpdates ?? true,
  emailPaymentReceived: user.notificationPreferences?.emailPaymentReceived ?? true,
  inAppNewMessages: user.notificationPreferences?.inAppNewMessages ?? true,
  inAppDocumentUploadUpdates:
    user.notificationPreferences?.inAppDocumentUploadUpdates ?? true,
  inAppMeetingRequests: user.notificationPreferences?.inAppMeetingRequests ?? true,
});

const trackedClientDocuments = [
  {
    key: "service-agreement",
    title: "Service Agreement",
    description: "Master service and confidentiality agreement.",
    optional: true,
  },
  {
    key: "w9-form",
    title: "W-9 Form",
    description: "Request for Taxpayer Identification Number.",
    optional: true,
  },
  {
    key: "eo-certificate",
    title: "E&O Certificate",
    description: "Proof of Errors and Omissions coverage.",
    optional: true,
  },
  {
    key: "business-license",
    title: "Business License",
    description: "State issued business or operational registration.",
    optional: true,
  },
];

const trackedNotaryDocuments = [
  {
    key: "service-agreement",
    title: "Service Agreement",
    description: "Acknowledgement of platform participation terms.",
    optional: false,
    aliases: ["Service Agreement"],
  },
  {
    key: "billing-setup-form",
    title: "Billing Setup Form",
    description: "Payment and payout setup confirmation for this notary account.",
    optional: false,
    aliases: ["Billing Setup Form"],
  },
  {
    key: "contact-confirmation",
    title: "Primary & Secondary Contact Confirmation",
    description: "Confirmation of active contact channels for assignment coordination.",
    optional: false,
    aliases: [
      "Primary & Secondary Contact Confirmation",
      "Primary and Secondary Contact Confirmation",
    ],
  },
  {
    key: "w9-form",
    title: "W-9",
    description: "Tax identification form for notary payment processing.",
    optional: false,
    aliases: ["W-9", "W-9 Form"],
  },
  {
    key: "business-license",
    title: "Business License or Registration",
    description: "Business registration or equivalent filing for the notary practice.",
    optional: false,
    aliases: ["Business License or Registration", "Business License"],
  },
  {
    key: "eo-certificate",
    title: "E&O Certificate",
    description: "Proof of active Errors & Omissions coverage.",
    optional: false,
    aliases: ["E&O Certificate", "E&O Insurance"],
  },
  {
    key: "portal-access-authorization",
    title: "Portal Access Authorization",
    description: "Internal authorization confirming portal access readiness.",
    optional: false,
    aliases: ["Portal Access Authorization"],
  },
];

const normalizeClientDocumentKey = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildTrackedClientDocuments = (user) => {
  const storedDocuments = user.requiredDocuments || [];

  return trackedClientDocuments.map((definition) => {
    const matched =
      storedDocuments.find((document) => document.id === definition.key) ||
      storedDocuments.find(
        (document) => normalizeClientDocumentKey(document.title) === definition.key
      );

    const hasFile = Boolean(matched?.file);
    const backendStatus = matched?.status || (hasFile ? "Pending" : "Missing");
    const displayStatus =
      backendStatus === "Pending" && hasFile ? "Uploaded" : backendStatus;

    return {
      id: definition.key,
      key: definition.key,
      title: definition.title,
      description: definition.description,
      optional: definition.optional,
      status: backendStatus,
      displayStatus,
      fileName: matched?.file ? matched.title || definition.title : "",
      mimeType: matched?.mimeType || null,
      size: matched?.size || null,
      uploadedAt: matched?.uploadedAt || null,
      viewUrl: matched?.file
        ? `/api/v1/files/users/${user.id}/documents/${matched.id}?mode=view`
        : null,
      downloadUrl: matched?.file
        ? `/api/v1/files/users/${user.id}/documents/${matched.id}?mode=download`
        : null,
    };
  });
};

const buildTrackedNotaryDocuments = (user) => {
  const storedDocuments = user.requiredDocuments || [];

  return trackedNotaryDocuments.map((definition) => {
    const matched =
      storedDocuments.find((document) => document.id === definition.key) ||
      storedDocuments.find((document) =>
        definition.aliases.some(
          (alias) => normalizeClientDocumentKey(alias) === normalizeClientDocumentKey(document.title)
        )
      );

    const hasFile = Boolean(matched?.file);
    const backendStatus = matched?.status || (hasFile ? "Pending" : "Missing");
    const displayStatus =
      backendStatus === "Pending" && hasFile ? "Uploaded" : backendStatus;

    return {
      id: definition.key,
      key: definition.key,
      title: definition.title,
      description: definition.description,
      optional: definition.optional,
      status: backendStatus,
      displayStatus,
      fileName: matched?.file ? matched.title || definition.title : "",
      mimeType: matched?.mimeType || null,
      size: matched?.size || null,
      uploadedAt: matched?.uploadedAt || null,
      viewUrl: matched?.file
        ? `/api/v1/files/users/${user.id}/documents/${matched.id}?mode=view`
        : null,
      downloadUrl: matched?.file
        ? `/api/v1/files/users/${user.id}/documents/${matched.id}?mode=download`
        : null,
    };
  });
};

const serializeClientProfileDetails = (user) => {
  const organization = user.organization || {};
  const address = user.address || {};
  const primaryRepresentative = {
    name: user.primaryContact?.name || user.name || "",
    email: user.primaryContact?.email || user.email || "",
    phone: user.primaryContact?.phone || "",
  };
  const secondaryRepresentative = {
    name: user.secondaryContact?.name || "",
    email: user.secondaryContact?.email || "",
    phone: user.secondaryContact?.phone || "",
  };
  const documents = buildTrackedClientDocuments(user);

  const profileChecks = [
    { key: "company-logo", label: "Company Logo", complete: Boolean(user.avatar) },
    { key: "website", label: "Website URL", complete: Boolean(organization.website) },
    {
      key: "office-address",
      label: "Full Office Address",
      complete: Boolean(address.line1 && address.city && address.state && address.zip),
    },
    {
      key: "primary-phone",
      label: "Primary Office Phone",
      complete: Boolean(organization.officePhone || primaryRepresentative.phone),
    },
    {
      key: "secondary-contact",
      label: "Secondary Contact Details",
      complete: Boolean(
        secondaryRepresentative.name &&
          secondaryRepresentative.email &&
          secondaryRepresentative.phone
      ),
    },
  ];

  const documentChecks = documents.map((document) => ({
    key: document.key,
    label: document.title,
    complete: document.status !== "Missing",
    optional: document.optional,
    status: document.displayStatus,
  }));

  const completedChecks = [...profileChecks, ...documentChecks].filter(
    (item) => item.complete
  ).length;
  const totalChecks = profileChecks.length + documentChecks.length;
  const completionPercent = totalChecks ? Math.round((completedChecks / totalChecks) * 100) : 0;

  const activity = documents
    .filter((document) => document.uploadedAt)
    .sort((left, right) => new Date(right.uploadedAt) - new Date(left.uploadedAt))
    .map((document) => ({
      id: document.key,
      title:
        document.displayStatus === "Verified"
          ? `${document.title} verified`
          : `${document.title} uploaded`,
      timestamp: document.uploadedAt,
      status: document.displayStatus,
    }));

  return {
    profile: serializePortalProfile(user),
    organization: {
      companyName: organization.companyName || user.company || "",
      website: organization.website || "",
      companyType: organization.companyType || "",
      officePhone: organization.officePhone || primaryRepresentative.phone || "",
    },
    address: {
      line1: address.line1 || "",
      line2: address.line2 || "",
      city: address.city || "",
      state: address.state || "",
      zip: address.zip || "",
    },
    representatives: {
      primary: primaryRepresentative,
      secondary: secondaryRepresentative,
    },
    checks: {
      profile: profileChecks,
      documents: documentChecks,
      completedChecks,
      totalChecks,
      completionPercent,
    },
    documents,
    activity,
  };
};

const serializeNotaryProfileDetails = (user) => {
  const address = user.address || {};
  const commission = user.commission || {};
  const personalInfo = user.personalInfo || {};
  const secondaryContact = user.secondaryContact || {};
  const documents = buildTrackedNotaryDocuments(user);
  const documentUploadedCount = documents.filter((document) => document.status !== "Missing").length;

  const profileChecks = [
    { key: "profile-photo", label: "Profile Photo", complete: Boolean(user.avatar) },
    { key: "coverage-areas", label: "Coverage Areas", complete: Boolean(commission.coverageAreas) },
    { key: "address-line-1", label: "Address Line 1", complete: Boolean(address.line1) },
    { key: "city", label: "City", complete: Boolean(address.city) },
    { key: "zip", label: "ZIP", complete: Boolean(address.zip) },
    {
      key: "main-office-phone",
      label: "Main Office Phone",
      complete: Boolean(personalInfo.phone),
      actionLabel: personalInfo.phone ? null : "Enter Phone",
    },
    {
      key: "secondary-contact-name",
      label: "Secondary Contact Name",
      complete: Boolean(secondaryContact.name),
    },
    {
      key: "secondary-contact-email",
      label: "Secondary Contact Email",
      complete: Boolean(secondaryContact.email),
    },
    {
      key: "secondary-contact-phone",
      label: "Secondary Contact Phone",
      complete: Boolean(secondaryContact.phone),
      actionLabel: secondaryContact.phone ? null : "Enter Phone",
    },
  ];

  const completedChecks = [
    ...profileChecks.map((item) => item.complete),
    ...documents.map((item) => item.status !== "Missing"),
  ].filter(Boolean).length;
  const totalChecks = profileChecks.length + documents.length;
  const completionPercent = totalChecks ? Math.round((completedChecks / totalChecks) * 100) : 0;

  return {
    profile: {
      ...serializePortalProfile(user),
      coverageAreas: commission.coverageAreas || "",
      address: {
        line1: address.line1 || "",
        line2: address.line2 || "",
        city: address.city || "",
        state: address.state || "",
        zip: address.zip || "",
      },
    },
    details: {
      profile: {
        name: user.name || personalInfo.fullName || "",
        email: user.email || personalInfo.email || "",
        phone: personalInfo.phone || "",
        coverageAreas: commission.coverageAreas || "",
      },
      address: {
        line1: address.line1 || "",
        line2: address.line2 || "",
        city: address.city || "",
        state: address.state || "",
        zip: address.zip || "",
      },
      commission: {
        number: commission.number || "",
        state: commission.state || "",
        expirationDate: commission.expirationDate || "",
        travelRadius: commission.travelRadius || "",
        eoCoverageAmount: commission.eoCoverageAmount || "",
      },
      additional: {
        ronApproval: commission.ronApproval || (user.ronEligible ? "approved" : "pending"),
        backgroundCheckDate: commission.backgroundCheckDate || "",
        specialties: Array.isArray(user.specialties) ? user.specialties : [],
        secondaryContactName: secondaryContact.name || "",
        secondaryContactEmail: secondaryContact.email || "",
        secondaryContactPhone: secondaryContact.phone || "",
      },
    },
    verification: {
      status: user.verification || "Pending",
      profileChecks,
      documents,
      completedChecks,
      totalChecks,
      completionPercent,
      documentUploadedCount,
    },
  };
};

const ensurePortalRole = (req, res, roleLabel) => {
  if (req.actor?.type !== "user" || req.actor.role !== roleLabel) {
    fail(
      res,
      403,
      "FORBIDDEN",
      `Only ${roleLabel.toLowerCase()} users can access this resource.`
    );
    return false;
  }

  return true;
};

const toCurrency = (value) => `$${Number(value || 0).toFixed(2)}`;

const serializeOrderPreview = (order) => ({
  id: order.id,
  title: order.clientCompany || order.clientName,
  borrower: order.signerName,
  status: order.status,
  type: order.isRon ? "RON" : "In-Person",
  location: order.isRon
    ? "Remote Online"
    : [order.propertyAddress?.city, order.propertyAddress?.state, order.propertyAddress?.zip]
        .filter(Boolean)
        .join(", "),
  fee: toCurrency(order.notaryOfferAmount ?? order.feeAmount ?? 0),
  date: `${order.signingDate} ${order.signingTime}`.trim(),
});

const serializeClientDocument = (document, context = {}) => ({
  id: document.id,
  name: document.title || document.name || "Untitled document",
  status: document.status || "Available",
  source: context.source || "Order",
  orderId: context.orderId || null,
  orderRoute: context.orderRoute || null,
  uploadedAt: document.uploadedAt || null,
  size: document.size || null,
  mimeType: document.mimeType || null,
  type:
    document.mimeType?.startsWith("image/")
      ? "Image"
      : document.mimeType?.includes("pdf")
        ? "PDF"
        : document.mimeType
          ? "File"
          : "Document",
  viewUrl: context.viewUrl || null,
  downloadUrl: context.downloadUrl || null,
});

siteRouter.get("/site/client/overview", requireAuthenticatedActor, async (req, res) => {
  if (!ensurePortalRole(req, res, "Client")) {
    return;
  }

  const [user, orders, payments] = await Promise.all([
    UserModel.findOne({ id: req.actor.id }).lean(),
    OrderModel.find({ clientUserId: req.actor.id }).sort({ createdAt: -1 }).lean(),
    PaymentModel.find({ clientUserId: req.actor.id }).sort({ createdAt: -1 }).lean(),
  ]);

  if (!user) {
    return fail(res, 404, "USER_NOT_FOUND", "Client not found.");
  }

  const pendingOrders = orders.filter((order) =>
    ["Pending Admin Review", "Accepted By Admin", "Needs Reassignment"].includes(order.status)
  ).length;

  const completedOrders = orders.filter((order) => order.status === "Completed").length;
  const outstandingPayments = payments.reduce(
    (sum, payment) =>
      sum +
      (payment.clientPayment?.status === "Received"
        ? 0
        : Number(payment.clientPayment?.amount || 0)),
    0
  );

  return ok(res, {
    profile: {
      ...serializePortalProfile(user),
    },
    stats: {
      totalOrders: orders.length,
      pendingOrders,
      completedOrders,
      outstandingPayments: toCurrency(outstandingPayments),
    },
    documents: user.requiredDocuments || [],
    recentOrders: orders.slice(0, 5).map(serializeOrderPreview),
  });
});

siteRouter.get("/site/client/documents", requireAuthenticatedActor, async (req, res) => {
  if (!ensurePortalRole(req, res, "Client")) {
    return;
  }

  const [user, orders] = await Promise.all([
    UserModel.findOne({ id: req.actor.id }).lean(),
    OrderModel.find({ clientUserId: req.actor.id }).sort({ createdAt: -1 }).lean(),
  ]);

  if (!user) {
    return fail(res, 404, "USER_NOT_FOUND", "Client not found.");
  }

  const identityDocuments = (user.requiredDocuments || []).map((document) =>
    serializeClientDocument(document, {
      source: "Verification",
      viewUrl: document.file
        ? `/api/v1/files/users/${user.id}/documents/${document.id}?mode=view`
        : null,
      downloadUrl: document.file
        ? `/api/v1/files/users/${user.id}/documents/${document.id}?mode=download`
        : null,
    })
  );

  const orderDocuments = orders.flatMap((order) => {
    const route = `/dashboard-client/orders/${order.id}`;
    const originalDocs = (order.documents || []).map((document) =>
      serializeClientDocument(document, {
        source: "Order Upload",
        orderId: `#${order.id}`,
        orderRoute: route,
        viewUrl: document.file
          ? `/api/v1/files/orders/${order.id}/documents/${document.id}?mode=view`
          : null,
        downloadUrl: document.file
          ? `/api/v1/files/orders/${order.id}/documents/${document.id}?mode=download`
          : null,
      })
    );

    const completedDocs = (order.completedDocuments || []).map((document) =>
      serializeClientDocument(document, {
        source: "Completed Package",
        orderId: `#${order.id}`,
        orderRoute: route,
        viewUrl: document.file
          ? `/api/v1/files/orders/${order.id}/completed-documents/${document.id}?mode=view`
          : null,
        downloadUrl: document.file
          ? `/api/v1/files/orders/${order.id}/completed-documents/${document.id}?mode=download`
          : null,
      })
    );

    return [...originalDocs, ...completedDocs];
  });

  const documents = [...orderDocuments, ...identityDocuments].sort((left, right) => {
    return new Date(right.uploadedAt || 0) - new Date(left.uploadedAt || 0);
  });

  return ok(res, documents);
});

siteRouter.get("/site/client/profile-details", requireAuthenticatedActor, async (req, res) => {
  if (!ensurePortalRole(req, res, "Client")) {
    return;
  }

  const user = await UserModel.findOne({ id: req.actor.id }).lean();
  if (!user) {
    return fail(res, 404, "USER_NOT_FOUND", "Client not found.");
  }

  return ok(res, serializeClientProfileDetails(user));
});

siteRouter.get(
  "/site/client/notification-preferences",
  requireAuthenticatedActor,
  async (req, res) => {
    if (!ensurePortalRole(req, res, "Client")) {
      return;
    }

    const user = await UserModel.findOne({ id: req.actor.id }).lean();
    if (!user) {
      return fail(res, 404, "USER_NOT_FOUND", "Client not found.");
    }

    return ok(res, serializeNotificationPreferences(user));
  }
);

siteRouter.get("/site/notary/overview", requireAuthenticatedActor, async (req, res) => {
  if (!ensurePortalRole(req, res, "Notary")) {
    return;
  }

  const [user, orders, payments] = await Promise.all([
    UserModel.findOne({ id: req.actor.id }).lean(),
    OrderModel.find({ notaryId: req.actor.id }).sort({ createdAt: -1 }).lean(),
    PaymentModel.find({ notaryId: req.actor.id }).sort({ createdAt: -1 }).lean(),
  ]);

  if (!user) {
    return fail(res, 404, "USER_NOT_FOUND", "Notary not found.");
  }

  const completedOrders = orders.filter((order) => order.status === "Completed");
  const openAssignments = orders.filter((order) =>
    ["Notary Assigned", "Accepted By Notary", "In Progress"].includes(order.status)
  );
  const pendingPayouts = payments.reduce(
    (sum, payment) =>
      sum +
      (payment.notaryPayout?.status === "Paid"
        ? 0
        : Number(payment.notaryPayout?.amount || 0)),
    0
  );

  return ok(res, {
    profile: {
      ...serializePortalProfile(user),
    },
    stats: {
      totalAssignments: orders.length,
      openAssignments: openAssignments.length,
      completedAssignments: completedOrders.length,
      pendingPayouts: toCurrency(pendingPayouts),
    },
    documents: user.requiredDocuments || [],
    recentAssignments: orders.slice(0, 5).map(serializeOrderPreview),
  });
});

siteRouter.get(
  "/site/notary/profile-details",
  requireAuthenticatedActor,
  async (req, res) => {
    if (!ensurePortalRole(req, res, "Notary")) {
      return;
    }

    const user = await UserModel.findOne({ id: req.actor.id }).lean();
    if (!user) {
      return fail(res, 404, "USER_NOT_FOUND", "Notary not found.");
    }

    return ok(res, serializeNotaryProfileDetails(user));
  }
);

siteRouter.patch(
  "/site/client/profile",
  requireAuthenticatedActor,
  validate(siteProfileSchema),
  async (req, res) => {
    if (!ensurePortalRole(req, res, "Client")) {
      return;
    }

    const updated = await UserModel.findOneAndUpdate(
      { id: req.actor.id },
      {
        $set: {
          name: req.body.name,
          email: req.body.email.toLowerCase(),
          company: req.body.company || "",
          "organization.companyName": req.body.company || "",
          "primaryContact.name": req.body.name,
          "primaryContact.email": req.body.email.toLowerCase(),
          "primaryContact.phone": req.body.phone || "",
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return fail(res, 404, "USER_NOT_FOUND", "Client not found.");
    }

    return ok(res, serializePortalProfile(updated), "Profile updated successfully.");
  }
);

siteRouter.patch(
  "/site/client/notification-preferences",
  requireAuthenticatedActor,
  validate(notificationPreferencesSchema),
  async (req, res) => {
    if (!ensurePortalRole(req, res, "Client")) {
      return;
    }

    const updated = await UserModel.findOneAndUpdate(
      { id: req.actor.id },
      {
        $set: {
          notificationPreferences: {
            emailNotifications: req.body.emailNotifications,
            orderUpdates: req.body.orderUpdates,
            paymentAlerts: req.body.paymentAlerts,
            directMessages: req.body.directMessages,
          },
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return fail(res, 404, "USER_NOT_FOUND", "Client not found.");
    }

    return ok(
      res,
      serializeNotificationPreferences(updated),
      "Notification preferences updated successfully."
    );
  }
);

siteRouter.patch(
  "/site/notary/profile",
  requireAuthenticatedActor,
  validate(siteProfileSchema),
  async (req, res) => {
    if (!ensurePortalRole(req, res, "Notary")) {
      return;
    }

    const updated = await UserModel.findOneAndUpdate(
      { id: req.actor.id },
      {
        $set: {
          name: req.body.name,
          email: req.body.email.toLowerCase(),
          company: req.body.company || "",
          "personalInfo.fullName": req.body.name,
          "personalInfo.email": req.body.email.toLowerCase(),
          "personalInfo.phone": req.body.phone || "",
          "commission.coverageAreas": req.body.coverageAreas || "",
          "address.line1": req.body.address?.line1 || "",
          "address.line2": req.body.address?.line2 || "",
          "address.city": req.body.address?.city || "",
          "address.state": req.body.address?.state || "",
          "address.zip": req.body.address?.zip || "",
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return fail(res, 404, "USER_NOT_FOUND", "Notary not found.");
    }

    return ok(res, serializePortalProfile(updated), "Profile updated successfully.");
  }
);

siteRouter.patch(
  "/site/notary/profile-details",
  requireAuthenticatedActor,
  validate(notaryProfileDetailsSchema),
  async (req, res) => {
    if (!ensurePortalRole(req, res, "Notary")) {
      return;
    }

    const updated = await UserModel.findOneAndUpdate(
      { id: req.actor.id },
      {
        $set: {
          name: req.body.profile.name,
          email: req.body.profile.email.toLowerCase(),
          "personalInfo.fullName": req.body.profile.name,
          "personalInfo.email": req.body.profile.email.toLowerCase(),
          "personalInfo.phone": req.body.profile.phone || "",
          "address.line1": req.body.address.line1 || "",
          "address.line2": req.body.address.line2 || "",
          "address.city": req.body.address.city || "",
          "address.state": req.body.address.state || "",
          "address.zip": req.body.address.zip || "",
          "commission.coverageAreas": req.body.profile.coverageAreas || "",
          "commission.number": req.body.commission.number || "",
          "commission.state": req.body.commission.state || "",
          "commission.expirationDate": req.body.commission.expirationDate || "",
          "commission.travelRadius": req.body.commission.travelRadius || "",
          "commission.eoCoverageAmount": req.body.commission.eoCoverageAmount || "",
          "commission.ronApproval": req.body.additional.ronApproval || "",
          "commission.backgroundCheckDate": req.body.additional.backgroundCheckDate || "",
          "secondaryContact.name": req.body.additional.secondaryContactName || "",
          "secondaryContact.email": req.body.additional.secondaryContactEmail || "",
          "secondaryContact.phone": req.body.additional.secondaryContactPhone || "",
          specialties: req.body.additional.specialties || [],
          ronEligible: req.body.additional.ronApproval === "approved",
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return fail(res, 404, "USER_NOT_FOUND", "Notary not found.");
    }

    return ok(
      res,
      serializeNotaryProfileDetails(updated),
      "Profile details updated successfully."
    );
  }
);

siteRouter.post(
  "/site/client/profile-photo",
  requireAuthenticatedActor,
  upload.single("profilePhoto"),
  async (req, res) => {
    if (!ensurePortalRole(req, res, "Client")) {
      return;
    }

    if (!req.file) {
      return fail(res, 400, "FILE_REQUIRED", "A profile photo file is required.");
    }

    if (!req.file.mimetype.startsWith("image/")) {
      return fail(res, 400, "INVALID_FILE_TYPE", "Only image files are allowed for profile photos.");
    }

    const avatarPath = `/uploads/${req.file.filename}`;
    const updated = await UserModel.findOneAndUpdate(
      { id: req.actor.id },
      { $set: { avatar: avatarPath } },
      { new: true }
    ).lean();

    if (!updated) {
      return fail(res, 404, "USER_NOT_FOUND", "Client not found.");
    }

    return ok(res, serializePortalProfile(updated), "Profile photo uploaded successfully.", 201);
  }
);

siteRouter.patch(
  "/site/client/profile-details",
  requireAuthenticatedActor,
  validate(clientProfileDetailsSchema),
  async (req, res) => {
    if (!ensurePortalRole(req, res, "Client")) {
      return;
    }

    const updated = await UserModel.findOneAndUpdate(
      { id: req.actor.id },
      {
        $set: {
          company: req.body.organization.companyName,
          "organization.companyName": req.body.organization.companyName,
          "organization.website": req.body.organization.website || "",
          "organization.companyType": req.body.organization.companyType || "",
          "organization.officePhone": req.body.organization.officePhone || "",
          "address.line1": req.body.address.line1 || "",
          "address.line2": req.body.address.line2 || "",
          "address.city": req.body.address.city || "",
          "address.state": req.body.address.state || "",
          "address.zip": req.body.address.zip || "",
          "primaryContact.name": req.body.primaryRepresentative.name || "",
          "primaryContact.email": req.body.primaryRepresentative.email || "",
          "primaryContact.phone": req.body.primaryRepresentative.phone || "",
          "secondaryContact.name": req.body.secondaryRepresentative.name || "",
          "secondaryContact.email": req.body.secondaryRepresentative.email || "",
          "secondaryContact.phone": req.body.secondaryRepresentative.phone || "",
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return fail(res, 404, "USER_NOT_FOUND", "Client not found.");
    }

    return ok(
      res,
      serializeClientProfileDetails(updated),
      "Profile details updated successfully."
    );
  }
);

siteRouter.post(
  "/site/client/profile-documents/:documentKey",
  requireAuthenticatedActor,
  validate(clientTrackedDocumentSchema),
  upload.single("document"),
  async (req, res) => {
    if (!ensurePortalRole(req, res, "Client")) {
      return;
    }

    if (!req.file) {
      return fail(res, 400, "FILE_REQUIRED", "A document file is required.");
    }

    const definition = trackedClientDocuments.find(
      (item) => item.key === req.params.documentKey
    );
    if (!definition) {
      return fail(res, 400, "INVALID_DOCUMENT", "Unsupported document type.");
    }

    const user = await UserModel.findOne({ id: req.actor.id });
    if (!user) {
      return fail(res, 404, "USER_NOT_FOUND", "Client not found.");
    }

    const currentDocuments = user.requiredDocuments || [];
    const nextDocument = {
      id: definition.key,
      title: definition.title,
      status: "Pending",
      file: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date(),
    };

    const nextDocuments = currentDocuments.filter(
      (document) =>
        document.id !== definition.key &&
        normalizeClientDocumentKey(document.title) !== definition.key
    );
    nextDocuments.push(nextDocument);

    user.requiredDocuments = nextDocuments;
    await user.save();

    return ok(
      res,
      serializeClientProfileDetails(user.toObject()),
      `${definition.title} uploaded successfully.`,
      201
    );
  }
);

siteRouter.post(
  "/site/notary/profile-photo",
  requireAuthenticatedActor,
  upload.single("profilePhoto"),
  async (req, res) => {
    if (!ensurePortalRole(req, res, "Notary")) {
      return;
    }

    if (!req.file) {
      return fail(res, 400, "FILE_REQUIRED", "A profile photo file is required.");
    }

    if (!req.file.mimetype.startsWith("image/")) {
      return fail(res, 400, "INVALID_FILE_TYPE", "Only image files are allowed for profile photos.");
    }

    const avatarPath = `/uploads/${req.file.filename}`;
    const updated = await UserModel.findOneAndUpdate(
      { id: req.actor.id },
      { $set: { avatar: avatarPath } },
      { new: true }
    ).lean();

    if (!updated) {
      return fail(res, 404, "USER_NOT_FOUND", "Notary not found.");
    }

    return ok(res, serializePortalProfile(updated), "Profile photo uploaded successfully.", 201);
  }
);

siteRouter.get(
  "/site/notary/notification-preferences",
  requireAuthenticatedActor,
  async (req, res) => {
    if (!ensurePortalRole(req, res, "Notary")) {
      return;
    }

    const user = await UserModel.findOne({ id: req.actor.id }).lean();
    if (!user) {
      return fail(res, 404, "USER_NOT_FOUND", "Notary not found.");
    }

    return ok(res, serializeNotaryNotificationPreferences(user));
  }
);

siteRouter.patch(
  "/site/notary/notification-preferences",
  requireAuthenticatedActor,
  validate(notaryNotificationPreferencesSchema),
  async (req, res) => {
    if (!ensurePortalRole(req, res, "Notary")) {
      return;
    }

    const updated = await UserModel.findOneAndUpdate(
      { id: req.actor.id },
      {
        $set: {
          "notificationPreferences.emailNewOrderAssigned":
            req.body.emailNewOrderAssigned,
          "notificationPreferences.emailOrderStatusUpdates":
            req.body.emailOrderStatusUpdates,
          "notificationPreferences.emailPaymentReceived":
            req.body.emailPaymentReceived,
          "notificationPreferences.inAppNewMessages":
            req.body.inAppNewMessages,
          "notificationPreferences.inAppDocumentUploadUpdates":
            req.body.inAppDocumentUploadUpdates,
          "notificationPreferences.inAppMeetingRequests":
            req.body.inAppMeetingRequests,
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return fail(res, 404, "USER_NOT_FOUND", "Notary not found.");
    }

    return ok(
      res,
      serializeNotaryNotificationPreferences(updated),
      "Notification preferences updated successfully."
    );
  }
);

siteRouter.post(
  "/site/notary/profile-documents/:documentKey",
  requireAuthenticatedActor,
  validate(notaryTrackedDocumentSchema),
  upload.single("document"),
  async (req, res) => {
    if (!ensurePortalRole(req, res, "Notary")) {
      return;
    }

    if (!req.file) {
      return fail(res, 400, "FILE_REQUIRED", "A document file is required.");
    }

    const definition = trackedNotaryDocuments.find(
      (item) => item.key === req.params.documentKey
    );
    if (!definition) {
      return fail(res, 400, "INVALID_DOCUMENT", "Unsupported document type.");
    }

    const user = await UserModel.findOne({ id: req.actor.id });
    if (!user) {
      return fail(res, 404, "USER_NOT_FOUND", "Notary not found.");
    }

    const currentDocuments = user.requiredDocuments || [];
    const nextDocument = {
      id: definition.key,
      title: definition.title,
      status: "Pending",
      file: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date(),
    };

    const nextDocuments = currentDocuments.filter(
      (document) =>
        document.id !== definition.key &&
        !definition.aliases.some(
          (alias) => normalizeClientDocumentKey(alias) === normalizeClientDocumentKey(document.title)
        )
    );
    nextDocuments.push(nextDocument);

    user.requiredDocuments = nextDocuments;
    await user.save();

    return ok(
      res,
      serializeNotaryProfileDetails(user.toObject()),
      `${definition.title} uploaded successfully.`,
      201
    );
  }
);

siteRouter.post(
  "/site/notary/verification/submit",
  requireAuthenticatedActor,
  async (req, res) => {
    if (!ensurePortalRole(req, res, "Notary")) {
      return;
    }

    const updated = await UserModel.findOneAndUpdate(
      { id: req.actor.id },
      { $set: { verification: "Pending Review" } },
      { new: true }
    ).lean();

    if (!updated) {
      return fail(res, 404, "USER_NOT_FOUND", "Notary not found.");
    }

    return ok(
      res,
      serializeNotaryProfileDetails(updated),
      "Verification submitted for review."
    );
  }
);

siteRouter.get("/site/client/bank-info", requireAuthenticatedActor, async (req, res) => {
  if (!ensurePortalRole(req, res, "Client")) {
    return;
  }

  const user = await UserModel.findOne({ id: req.actor.id }).lean();

  if (!user) {
    return fail(res, 404, "USER_NOT_FOUND", "Client not found.");
  }

  const bankInfo = decryptBankInfo(user.bankInfoEncrypted);
  if (!bankInfo) {
    return fail(res, 404, "BANK_INFO_NOT_FOUND", "Bank info not found.");
  }

  return ok(res, bankInfo);
});

siteRouter.post(
  "/site/client/bank-info",
  requireAuthenticatedActor,
  validate(siteBankInfoSchema),
  async (req, res) => {
    if (!ensurePortalRole(req, res, "Client")) {
      return;
    }

    const encrypted = encryptBankInfo(req.body);
    const updated = await UserModel.findOneAndUpdate(
      { id: req.actor.id },
      {
        $set: {
          bankInfoEncrypted: encrypted.encrypted,
          bankInfoMasked: encrypted.masked,
          bankInfoUpdatedAt: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return fail(res, 404, "USER_NOT_FOUND", "Client not found.");
    }

    return ok(res, updated.bankInfoMasked, "Bank info saved successfully.", 201);
  }
);

siteRouter.patch(
  "/site/client/bank-info",
  requireAuthenticatedActor,
  validate(siteBankInfoSchema),
  async (req, res) => {
    if (!ensurePortalRole(req, res, "Client")) {
      return;
    }

    const encrypted = encryptBankInfo(req.body);
    const updated = await UserModel.findOneAndUpdate(
      { id: req.actor.id },
      {
        $set: {
          bankInfoEncrypted: encrypted.encrypted,
          bankInfoMasked: encrypted.masked,
          bankInfoUpdatedAt: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return fail(res, 404, "USER_NOT_FOUND", "Client not found.");
    }

    return ok(res, updated.bankInfoMasked, "Bank info updated successfully.");
  }
);

siteRouter.get("/site/notary/bank-info", requireAuthenticatedActor, async (req, res) => {
  if (!ensurePortalRole(req, res, "Notary")) {
    return;
  }

  const user = await UserModel.findOne({ id: req.actor.id }).lean();

  if (!user) {
    return fail(res, 404, "USER_NOT_FOUND", "Notary not found.");
  }

  const bankInfo = decryptBankInfo(user.bankInfoEncrypted);
  if (!bankInfo) {
    return fail(res, 404, "BANK_INFO_NOT_FOUND", "Bank info not found.");
  }

  return ok(res, bankInfo);
});

siteRouter.post(
  "/site/notary/bank-info",
  requireAuthenticatedActor,
  validate(siteBankInfoSchema),
  async (req, res) => {
    if (!ensurePortalRole(req, res, "Notary")) {
      return;
    }

    const encrypted = encryptBankInfo(req.body);
    const updated = await UserModel.findOneAndUpdate(
      { id: req.actor.id },
      {
        $set: {
          bankInfoEncrypted: encrypted.encrypted,
          bankInfoMasked: encrypted.masked,
          bankInfoUpdatedAt: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return fail(res, 404, "USER_NOT_FOUND", "Notary not found.");
    }

    return ok(res, updated.bankInfoMasked, "Bank info saved successfully.", 201);
  }
);

siteRouter.patch(
  "/site/notary/bank-info",
  requireAuthenticatedActor,
  validate(siteBankInfoSchema),
  async (req, res) => {
    if (!ensurePortalRole(req, res, "Notary")) {
      return;
    }

    const encrypted = encryptBankInfo(req.body);
    const updated = await UserModel.findOneAndUpdate(
      { id: req.actor.id },
      {
        $set: {
          bankInfoEncrypted: encrypted.encrypted,
          bankInfoMasked: encrypted.masked,
          bankInfoUpdatedAt: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return fail(res, 404, "USER_NOT_FOUND", "Notary not found.");
    }

    return ok(res, updated.bankInfoMasked, "Bank info updated successfully.");
  }
);

siteRouter.get("/site/admin/users/:id/bank-info", requireAdminAuth, async (req, res) => {
  const user = await UserModel.findOne({ id: req.params.id }).lean();

  if (!user) {
    return fail(res, 404, "USER_NOT_FOUND", "User not found.");
  }

  const bankInfo = buildMaskedBankInfo(user);
  if (!bankInfo) {
    return fail(res, 404, "BANK_INFO_NOT_FOUND", "Bank info not found.");
  }

  return ok(res, bankInfo);
});

siteRouter.get("/site/documents/:id", async (req, res) => {
  return fail(
    res,
    410,
    "LEGACY_ENDPOINT_REMOVED",
    "This legacy endpoint has been removed. Use the secure /files endpoints instead."
  );
});

siteRouter.get("/site/sessions/:id", async (req, res) => {
  const order = await OrderModel.findOne({ id: req.params.id }).lean();

  if (!order) {
    return fail(res, 404, "SESSION_NOT_FOUND", "Session not found.");
  }

  return ok(res, {
    id: order.id,
    title: order.clientCompany || order.clientName,
    borrower: order.signerName,
    status: order.status,
    type: order.isRon ? "RON" : "In-Person",
    location: order.isRon
      ? "Remote Online"
      : [order.propertyAddress?.city, order.propertyAddress?.state, order.propertyAddress?.zip]
          .filter(Boolean)
          .join(", "),
    fee: toCurrency(order.notaryOfferAmount ?? order.feeAmount ?? 0),
  });
});
