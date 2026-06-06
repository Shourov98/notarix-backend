import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import {
  requireAdminAuth,
  requireAuthenticatedActor,
  requireAdminRole,
} from "../../shared/http/auth-middleware.js";
import { fail, ok } from "../../shared/http/respond.js";
import {
  buildPaginationMeta,
  parsePaginationQuery,
} from "../../shared/http/pagination.js";
import { validate } from "../../shared/middleware/validate.js";
import { queueEmail } from "../../shared/notifications/email.service.js";
import {
  buildMaskedBankInfo,
  decryptBankInfo,
  encryptBankInfo,
} from "../../shared/security/bank-info.js";
import { hashPassword } from "../../shared/security/password.js";
import { upload } from "../../shared/storage/upload.js";
import { createAuditLog } from "../audit/audit.service.js";
import { AdminModel } from "./admin.model.js";
import { UserModel } from "./user.model.js";

export const usersRouter = Router();

const logProvisionedCredentials = ({ role, email, temporaryPassword }) => {
  console.log(
    `[account-created] role=${role} email=${email} temporaryPassword=${temporaryPassword}`
  );
};

const REQUIRED_NOTARY_DOCUMENTS = [
  "Commission Certificate",
  "E&O Insurance",
  "Background Check",
  "Government ID",
];

const ADMIN_PERMISSIONS = [
  "manage_orders",
  "manage_payments",
  "manage_users",
  "access_reports",
];

const adminCreateSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    role: z.enum(["admin", "super_admin"]).default("admin"),
    phone: z.string().min(7).optional(),
    permissions: z.array(z.enum(ADMIN_PERMISSIONS)).optional(),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

const requiredDocumentSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  status: z.enum(["Missing", "Pending", "Verified", "Rejected"]).optional(),
  file: z.string().nullable().optional(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
});

const clientCreateSchema = z.object({
  body: z.object({
    loginEmail: z.string().email().optional(),
    organization: z.object({
      companyName: z.string().min(2),
      companyType: z.string().optional(),
      website: z.string().optional(),
      mainOfficePhone: z.string().optional(),
    }),
    address: z.object({
      line1: z.string().min(2),
      line2: z.string().optional(),
      city: z.string().min(2),
      state: z.string().min(2),
      zip: z.string().min(2),
      country: z.string().optional(),
    }),
    primaryContact: z.object({
      name: z.string().min(2),
      email: z.string().email(),
      phone: z.string().min(7),
    }),
    secondaryContact: z
      .object({
        name: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional(),
      })
      .optional(),
    passwordResetRequired: z.boolean().optional(),
    requiredDocuments: z.array(requiredDocumentSchema).optional(),
    sendInviteEmail: z.boolean().optional(),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

const notaryCreateSchema = z.object({
  body: z.object({
    loginEmail: z.string().email().optional(),
    personalInfo: z.object({
      fullName: z.string().min(2),
      email: z.string().email(),
      phone: z.string().min(7),
    }),
    address: z.object({
      line1: z.string().min(2),
      line2: z.string().optional(),
      city: z.string().min(2),
      state: z.string().min(2),
      zip: z.string().min(2),
      country: z.string().optional(),
    }),
    commission: z.object({
      number: z.string().min(2),
      state: z.string().min(2),
      expirationDate: z.string().min(2),
      travelRadius: z.string().optional(),
      coverageAreas: z.string().optional(),
    }),
    passwordResetRequired: z.boolean().optional(),
    ronEligible: z.boolean().optional(),
    requiredDocuments: z.array(requiredDocumentSchema).optional(),
    sendInviteEmail: z.boolean().optional(),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

const userDocumentStatusSchema = z.object({
  body: z.object({
    status: z.enum(["Pending", "Verified", "Rejected", "Missing"]),
  }),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().min(1),
    documentId: z.string().min(1),
  }),
});

const bankInfoSchema = z.object({
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

const adminUsersListSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    search: z.string().optional(),
    role: z.string().optional(),
    status: z.string().optional(),
    page: z.string().optional(),
    pageSize: z.string().optional(),
  }).passthrough(),
  params: z.object({}).passthrough(),
});

const adminAdminsListSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    search: z.string().optional(),
    role: z.string().optional(),
    status: z.string().optional(),
    page: z.string().optional(),
    pageSize: z.string().optional(),
  }).passthrough(),
  params: z.object({}).passthrough(),
});

const adminDocumentsListSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    search: z.string().optional(),
    role: z.string().optional(),
    status: z.string().optional(),
    page: z.string().optional(),
    pageSize: z.string().optional(),
  }).passthrough(),
  params: z.object({}).passthrough(),
});

const serializeUser = (user) => {
  const {
    passwordHash,
    generatedPassword,
    bankInfoEncrypted,
    ...safeUser
  } = user;

  return {
    ...safeUser,
    avatar: user.avatar ? `/api/v1/files/users/${user.id}/avatar?mode=view` : null,
    requiredDocuments: (user.requiredDocuments || []).map((document) => ({
      ...document,
      url: document.file
        ? `/api/v1/files/users/${user.id}/documents/${document.id}?mode=view`
        : null,
      downloadUrl: document.file
        ? `/api/v1/files/users/${user.id}/documents/${document.id}?mode=download`
        : null,
    })),
    bankInfo: buildMaskedBankInfo(user),
  };
};

const createDocumentRecord = (document) => ({
  id: document.id || `doc-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
  title: document.title,
  status: document.status || (document.file ? "Pending" : "Missing"),
  file: document.file || null,
  mimeType: document.mimeType,
  size: document.size,
  uploadedAt: document.uploadedAt || new Date(),
});

const serializeAdminDocumentRow = (user, document) => {
  const safeUser = serializeUser(user);

  return {
    id: document.id,
    name: document.title,
    title: document.title,
    orderId: "",
    uploadedBy: safeUser.name,
    uploadedByLabel: safeUser.name,
    uploadedById: safeUser.id,
    uploadedByEmail: safeUser.email,
    userId: safeUser.id,
    role: safeUser.role,
    type: safeUser.role === "Notary" ? "Notary" : "Client",
    date: document.uploadedAt
      ? new Date(document.uploadedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Not set",
    uploadedAt: document.uploadedAt || null,
    status: document.status || "Missing",
    selected: false,
    file: document.file || null,
    url: document.url || null,
    downloadUrl: document.downloadUrl || null,
  };
};

const upsertRequiredDocument = (documents, nextDocument) => {
  const existingIndex = documents.findIndex(
    (item) => item.id === nextDocument.id || item.title === nextDocument.title
  );

  if (existingIndex === -1) {
    documents.push(nextDocument);
    return;
  }

  documents[existingIndex] = {
    ...documents[existingIndex],
    ...nextDocument,
  };
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const normalizeAdminPermissions = (permissions = [], role = "admin") =>
  role === "super_admin"
    ? [...ADMIN_PERMISSIONS]
    : [...new Set((permissions || []).filter((item) => ADMIN_PERMISSIONS.includes(item)))];

const ensureUniqueUserEmail = async (email) => {
  const [existingUser, existingAdmin] = await Promise.all([
    UserModel.findOne({ email }).lean(),
    AdminModel.findOne({ email }).lean(),
  ]);
  return !(existingUser || existingAdmin);
};

const hasAllRequiredNotaryDocuments = (documents = []) =>
  REQUIRED_NOTARY_DOCUMENTS.every((title) =>
    documents.some(
      (document) =>
        document?.title === title &&
        document?.file &&
        document?.status !== "Missing"
    )
  );

const listMissingNotaryDocuments = (documents = []) =>
  REQUIRED_NOTARY_DOCUMENTS.filter(
    (title) =>
      !documents.some(
        (document) =>
          document?.title === title &&
          document?.file &&
          document?.status !== "Missing"
      )
  );

usersRouter.get("/admin/users", requireAdminAuth, validate(adminUsersListSchema), async (req, res) => {
  const search = String(req.query.search || "").trim().toLowerCase();
  const role = String(req.query.role || "").trim().toLowerCase();
  const status = String(req.query.status || "").trim().toLowerCase();

  const query = {};
  if (role) {
    query.role = new RegExp(`^${role}$`, "i");
  }
  if (status) {
    query.status = new RegExp(`^${status}$`, "i");
  }
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { company: { $regex: search, $options: "i" } },
      { area: { $regex: search, $options: "i" } },
    ];
  }

  const { page, pageSize, skip } = parsePaginationQuery(req.query);
  const [totalItems, filtered] = await Promise.all([
    UserModel.countDocuments(query),
    UserModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
  ]);

  return ok(res, {
    items: filtered,
    pagination: buildPaginationMeta({ page, pageSize, totalItems }),
  });
});

usersRouter.get("/admin/users/:id", requireAdminAuth, async (req, res) => {
  const user = await UserModel.findOne({ id: req.params.id }).lean();

  if (!user) {
    return fail(res, 404, "USER_NOT_FOUND", "User not found.");
  }

  return ok(res, serializeUser(user));
});

usersRouter.post(
  "/admin/users/client",
  requireAdminAuth,
  validate(clientCreateSchema),
  async (req, res) => {
    const email = normalizeEmail(
      req.body?.loginEmail || req.body?.primaryContact?.email || ""
    );
    const name = String(req.body?.primaryContact?.name || "New Client");
    const company = String(
      req.body?.organization?.companyName || "New Organization"
    );
    const isUniqueEmail = await ensureUniqueUserEmail(email);

    if (!isUniqueEmail) {
      return fail(res, 409, "EMAIL_ALREADY_EXISTS", "An account with that email already exists.");
    }

    const temporaryPassword = crypto.randomBytes(6).toString("base64url");
    const passwordHash = await hashPassword(temporaryPassword);

    const newUser = {
      id: `client-${Date.now()}`,
      name,
      email,
      passwordHash,
      passwordResetRequired: req.body?.passwordResetRequired !== false,
      role: "Client",
      avatar: null,
      company,
      area: req.body?.address?.state || "Unknown",
      status: "Active",
      verification: "Pending",
      avatarTone: "bg-cyan-100 text-cyan-700",
      organization: req.body?.organization || {},
      address: req.body?.address || {},
      primaryContact: req.body?.primaryContact || {},
      secondaryContact: req.body?.secondaryContact || {},
      requiredDocuments: (req.body?.requiredDocuments || []).map(createDocumentRecord),
    };

    await UserModel.create(newUser);

    await queueEmail({
      to: email,
      subject: "Your Notarix client account is ready",
      text: [
        `Hello ${name},`,
        "",
        "Your Notarix client account has been created.",
        `Temporary password: ${temporaryPassword}`,
        "Please sign in and reset your password on first login.",
      ].join("\n"),
      html: `
        <p>Hello ${name},</p>
        <p>Your Notarix client account has been created.</p>
        <p><strong>Temporary password:</strong> ${temporaryPassword}</p>
        <p>Please sign in and reset your password on first login.</p>
      `,
      category: "client-invite",
    });
    logProvisionedCredentials({
      role: "Client",
      email,
      temporaryPassword,
    });
    await createAuditLog({
      action: "user.created",
      entityType: "user",
      entityId: newUser.id,
      title: "Client account created",
      summary: `${email} was created by admin.`,
      actor: req.admin,
      metadata: { role: "Client", company },
    });

    return ok(
      res,
      {
        userId: newUser.id,
        role: newUser.role,
        status: newUser.status,
        verified: false,
        temporaryPassword,
        passwordResetRequired: true,
      },
      "Client created successfully",
      201
    );
  }
);

usersRouter.post(
  "/admin/users/notary",
  requireAdminAuth,
  validate(notaryCreateSchema),
  async (req, res) => {
    const email = normalizeEmail(
      req.body?.loginEmail || req.body?.personalInfo?.email || ""
    );
    const name = String(req.body?.personalInfo?.fullName || "New Notary");
    const isUniqueEmail = await ensureUniqueUserEmail(email);

    if (!isUniqueEmail) {
      return fail(res, 409, "EMAIL_ALREADY_EXISTS", "An account with that email already exists.");
    }

    if (!hasAllRequiredNotaryDocuments(req.body?.requiredDocuments || [])) {
      return fail(
        res,
        400,
        "MISSING_REQUIRED_DOCUMENTS",
        "All required notary documents must be uploaded before creating the account.",
        { missingDocuments: listMissingNotaryDocuments(req.body?.requiredDocuments || []) }
      );
    }

    const temporaryPassword = crypto.randomBytes(6).toString("base64url");
    const passwordHash = await hashPassword(temporaryPassword);

    const newUser = {
      id: `notary-${Date.now()}`,
      name,
      email,
      passwordHash,
      passwordResetRequired: req.body?.passwordResetRequired !== false,
      role: "Notary",
      avatar: null,
      company: name,
      area: req.body?.address?.state || "Unknown",
      status: "Pending",
      verification: "Pending",
      avatarTone: "bg-orange-100 text-orange-700",
      personalInfo: req.body?.personalInfo || {},
      commission: req.body?.commission || {},
      address: req.body?.address || {},
      ronEligible: req.body?.ronEligible !== false,
      specialties: req.body?.ronEligible === false ? [] : ["RON"],
      requiredDocuments: (req.body?.requiredDocuments || []).map(createDocumentRecord),
    };

    await UserModel.create(newUser);

    await queueEmail({
      to: email,
      subject: "Your Notarix notary account is ready",
      text: [
        `Hello ${name},`,
        "",
        "Your Notarix notary account has been created.",
        `Temporary password: ${temporaryPassword}`,
        "Please sign in and reset your password on first login.",
      ].join("\n"),
      html: `
        <p>Hello ${name},</p>
        <p>Your Notarix notary account has been created.</p>
        <p><strong>Temporary password:</strong> ${temporaryPassword}</p>
        <p>Please sign in and reset your password on first login.</p>
      `,
      category: "notary-invite",
    });
    logProvisionedCredentials({
      role: "Notary",
      email,
      temporaryPassword,
    });
    await createAuditLog({
      action: "user.created",
      entityType: "user",
      entityId: newUser.id,
      title: "Notary account created",
      summary: `${email} was created by admin.`,
      actor: req.admin,
      metadata: { role: "Notary", ronEligible: newUser.ronEligible },
    });

    return ok(
      res,
      {
        userId: newUser.id,
        role: newUser.role,
        status: newUser.status,
        verified: false,
        temporaryPassword,
        passwordResetRequired: true,
      },
      "Notary created successfully",
      201
    );
  }
);

usersRouter.post(
  "/admin/users/admin",
  requireAdminAuth,
  requireAdminRole("super_admin"),
  validate(adminCreateSchema),
  async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();

    const [existingAdmin, existingUser] = await Promise.all([
      AdminModel.findOne({ email }).lean(),
      UserModel.findOne({ email }).lean(),
    ]);

    if (existingAdmin || existingUser) {
      return fail(res, 409, "EMAIL_ALREADY_EXISTS", "An account with that email already exists.");
    }

    const permissions = normalizeAdminPermissions(
      req.body.permissions,
      req.body.role
    );

    if (req.body.role === "admin" && permissions.length === 0) {
      return fail(
        res,
        400,
        "MISSING_PERMISSIONS",
        "Select at least one permission for a standard admin account."
      );
    }

    const temporaryPassword = crypto.randomBytes(6).toString("base64url");
    const passwordHash = await hashPassword(temporaryPassword);

    const newAdmin = {
      id: `admin-${Date.now()}`,
      name: req.body.name.trim(),
      email,
      passwordHash,
      role: req.body.role,
      permissions,
      isVerified: true,
      passwordResetRequired: true,
      phone: req.body.phone || null,
      avatar: "/profile.jpg",
      status: "Active",
      forgotOtp: null,
      forgotOtpVerified: false,
      refreshToken: null,
      lastSignInAt: null,
      createdBy: req.admin.id,
      createdAt: new Date().toISOString(),
    };

    await AdminModel.create(newAdmin);
    logProvisionedCredentials({
      role: req.body.role,
      email,
      temporaryPassword,
    });
    await createAuditLog({
      action: "admin.created",
      entityType: "admin",
      entityId: newAdmin.id,
      title: "Admin account created",
      summary: `${email} was created by super admin.`,
      actor: req.admin,
      metadata: { role: newAdmin.role, permissions: newAdmin.permissions },
    });

    return ok(
      res,
      {
        adminId: newAdmin.id,
        email: newAdmin.email,
        role: newAdmin.role,
        permissions: newAdmin.permissions,
        passwordResetRequired: true,
        temporaryPassword,
      },
      "Admin created successfully.",
      201
    );
  }
);

usersRouter.get(
  "/admin/admins",
  requireAdminAuth,
  requireAdminRole("super_admin"),
  validate(adminAdminsListSchema),
  async (req, res) => {
    const search = String(req.query.search || "").trim();
    const role = String(req.query.role || "").trim();
    const status = String(req.query.status || "").trim();

    const query = {};
    if (role) {
      query.role = new RegExp(`^${role}$`, "i");
    }
    if (status) {
      query.status = new RegExp(`^${status}$`, "i");
    }
    if (search) {
      query.$or = [
        { id: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const { page, pageSize, skip } = parsePaginationQuery(req.query);
    const [totalItems, adminRecords] = await Promise.all([
      AdminModel.countDocuments(query),
      AdminModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    ]);
    const admins = adminRecords.map((admin) => ({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      permissions: normalizeAdminPermissions(admin.permissions, admin.role),
      status: admin.status || "Active",
      phone: admin.phone || null,
      lastSignInAt: admin.lastSignInAt || null,
      createdAt: admin.createdAt || null,
    }));

    return ok(res, {
      items: admins,
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    });
  }
);

usersRouter.get(
  "/admin/documents",
  requireAdminAuth,
  validate(adminDocumentsListSchema),
  async (req, res) => {
    const search = String(req.query.search || "").trim().toLowerCase();
    const role = String(req.query.role || "").trim().toLowerCase();
    const status = String(req.query.status || "").trim().toLowerCase();

    const userQuery = {};
    if (role && role !== "internal") {
      userQuery.role = new RegExp(`^${role}$`, "i");
    }

    const users = await UserModel.find(userQuery).sort({ createdAt: -1 }).lean();
    const rows = users
      .flatMap((user) =>
        (serializeUser(user).requiredDocuments || []).map((document) =>
          serializeAdminDocumentRow(user, document)
        )
      )
      .filter((row) => {
        if (status && row.status.toLowerCase() !== status) {
          return false;
        }

        if (!search) {
          return true;
        }

        return [
          row.id,
          row.name,
          row.uploadedBy,
          row.uploadedByEmail,
          row.type,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      })
      .sort((left, right) => new Date(right.uploadedAt || 0) - new Date(left.uploadedAt || 0));

    const { page, pageSize, skip } = parsePaginationQuery(req.query);
    const totalItems = rows.length;
    const items = rows.slice(skip, skip + pageSize);

    return ok(res, {
      items,
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    });
  }
);

const updateAdminStatus = async (adminId, nextStatus) =>
  AdminModel.findOneAndUpdate(
    { id: adminId },
    { $set: { status: nextStatus } },
    { new: true }
  ).lean();

usersRouter.patch(
  "/admin/admins/:id/suspend",
  requireAdminAuth,
  requireAdminRole("super_admin"),
  async (req, res) => {
    if (req.admin.id === req.params.id) {
      return fail(res, 400, "INVALID_ACTION", "You cannot suspend your own account.");
    }

    const updated = await updateAdminStatus(req.params.id, "Suspended");

    if (!updated) {
      return fail(res, 404, "ADMIN_NOT_FOUND", "Admin not found.");
    }

    return ok(res, updated, "Admin suspended successfully.");
  }
);

usersRouter.patch(
  "/admin/admins/:id/activate",
  requireAdminAuth,
  requireAdminRole("super_admin"),
  async (req, res) => {
    const updated = await updateAdminStatus(req.params.id, "Active");

    if (!updated) {
      return fail(res, 404, "ADMIN_NOT_FOUND", "Admin not found.");
    }

    return ok(res, updated, "Admin activated successfully.");
  }
);

usersRouter.patch("/admin/users/:id/status", requireAdminAuth, async (req, res) => {
  const nextStatus = String(req.body?.status || "");
  const update = nextStatus ? { status: nextStatus } : {};
  const updated = await UserModel.findOneAndUpdate(
    { id: req.params.id },
    { $set: update },
    { new: true }
  ).lean();

  if (!updated) {
    return fail(res, 404, "USER_NOT_FOUND", "User not found.");
  }

  return ok(res, updated, "User status updated.");
});

usersRouter.post(
  "/users/bank-info",
  requireAuthenticatedActor,
  validate(bankInfoSchema),
  async (req, res) => {
    if (req.actor.type !== "user") {
      return fail(res, 403, "FORBIDDEN", "Only users can save bank info here.");
    }

    const existingUser = await UserModel.findOne({ id: req.actor.id }).lean();
    if (existingUser?.bankInfoEncrypted) {
      return fail(
        res,
        409,
        "BANK_INFO_ALREADY_EXISTS",
        "Bank info already exists. Use update instead."
      );
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
      return fail(res, 404, "USER_NOT_FOUND", "User not found.");
    }

    return ok(res, updated.bankInfoMasked, "Bank info saved successfully.", 201);
  }
);

usersRouter.patch(
  "/users/bank-info",
  requireAuthenticatedActor,
  validate(bankInfoSchema),
  async (req, res) => {
    if (req.actor.type !== "user") {
      return fail(res, 403, "FORBIDDEN", "Only users can update bank info here.");
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
      return fail(res, 404, "USER_NOT_FOUND", "User not found.");
    }

    return ok(res, updated.bankInfoMasked, "Bank info updated successfully.");
  }
);

usersRouter.get("/users/bank-info", requireAuthenticatedActor, async (req, res) => {
  if (req.actor.type !== "user") {
    return fail(res, 403, "FORBIDDEN", "Only users can access bank info here.");
  }

  const user = await UserModel.findOne({ id: req.actor.id }).lean();

  if (!user) {
    return fail(res, 404, "USER_NOT_FOUND", "User not found.");
  }

  const bankInfo = decryptBankInfo(user.bankInfoEncrypted);
  if (!bankInfo) {
    return fail(res, 404, "BANK_INFO_NOT_FOUND", "Bank info not found.");
  }

  return ok(res, bankInfo);
});

usersRouter.get("/admin/users/:id/bank-info", requireAdminAuth, async (req, res) => {
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

const updateUserLifecycleStatus = async (userId, nextStatus) =>
  UserModel.findOneAndUpdate(
    { id: userId },
    { $set: { status: nextStatus } },
    { new: true }
  ).lean();

usersRouter.patch("/admin/users/:id/suspend", requireAdminAuth, async (req, res) => {
  const updated = await updateUserLifecycleStatus(req.params.id, "Suspended");

  if (!updated) {
    return fail(res, 404, "USER_NOT_FOUND", "User not found.");
  }

  return ok(res, updated, "User suspended successfully.");
});

usersRouter.patch("/admin/users/:id/activate", requireAdminAuth, async (req, res) => {
  const updated = await updateUserLifecycleStatus(req.params.id, "Active");

  if (!updated) {
    return fail(res, 404, "USER_NOT_FOUND", "User not found.");
  }

  return ok(res, updated, "User activated successfully.");
});

usersRouter.post(
  "/admin/users/:id/profile-photo",
  requireAdminAuth,
  upload.single("profilePhoto"),
  async (req, res) => {
    if (!req.file) {
      return fail(res, 400, "FILE_REQUIRED", "A profile photo file is required.");
    }

    if (!req.file.mimetype.startsWith("image/")) {
      return fail(res, 400, "INVALID_FILE_TYPE", "Only image files are allowed for profile photos.");
    }

    const avatarPath = `/uploads/${req.file.filename}`;
    const updated = await UserModel.findOneAndUpdate(
      { id: req.params.id },
      { $set: { avatar: avatarPath } },
      { new: true }
    ).lean();

    if (!updated) {
      return fail(res, 404, "USER_NOT_FOUND", "User not found.");
    }

    return ok(
      res,
      { avatar: updated.avatar },
      "Profile photo uploaded successfully.",
      201
    );
  }
);

usersRouter.post(
  "/admin/users/:id/documents",
  requireAdminAuth,
  upload.array("documents", 5),
  async (req, res) => {
    const files = req.files || [];
    const rawTitles = req.body?.documentTitles;
    const documentTitles = Array.isArray(rawTitles)
      ? rawTitles
      : rawTitles
        ? [rawTitles]
        : [];
    const user = await UserModel.findOne({ id: req.params.id }).lean();

    if (!user) {
      return fail(res, 404, "USER_NOT_FOUND", "User not found.");
    }

    const existingDocuments = [...(user.requiredDocuments || [])];
    files.forEach((file, index) => {
      const title = documentTitles[index] || file.originalname;
      upsertRequiredDocument(
        existingDocuments,
        createDocumentRecord({
          title,
          status: "Verified",
          file: file.filename,
          mimeType: file.mimetype,
          size: file.size,
        })
      );
    });

    const updated = await UserModel.findOneAndUpdate(
      { id: req.params.id },
      { $set: { requiredDocuments: existingDocuments } },
      { new: true }
    ).lean();

    if (!updated) {
      return fail(res, 404, "USER_NOT_FOUND", "User not found.");
    }

    await createAuditLog({
      action: "document.uploaded",
      entityType: "user",
      entityId: updated.id,
      title: "User documents uploaded",
      summary: `${files.length} verification document(s) uploaded.`,
      actor: req.admin,
      metadata: { fileCount: files.length, titles: documentTitles },
    });

    return ok(res, serializeUser(updated).requiredDocuments, "Documents uploaded successfully.", 201);
  }
);

usersRouter.get("/admin/users/:id/documents", requireAdminAuth, async (req, res) => {
  const user = await UserModel.findOne({ id: req.params.id }).lean();

  if (!user) {
    return fail(res, 404, "USER_NOT_FOUND", "User not found.");
  }

  return ok(res, serializeUser(user).requiredDocuments || []);
});

usersRouter.patch(
  "/admin/users/:id/documents/:documentId/status",
  requireAdminAuth,
  validate(userDocumentStatusSchema),
  async (req, res) => {
    const user = await UserModel.findOne({ id: req.params.id }).lean();

    if (!user) {
      return fail(res, 404, "USER_NOT_FOUND", "User not found.");
    }

    const nextDocuments = [...(user.requiredDocuments || [])];
    const document = nextDocuments.find((item) => item.id === req.params.documentId);

    if (!document) {
      return fail(res, 404, "DOCUMENT_NOT_FOUND", "Document not found.");
    }

    document.status = req.body.status;
    if (req.body.status === "Missing") {
      document.file = null;
      document.mimeType = null;
      document.size = null;
    }

    const updated = await UserModel.findOneAndUpdate(
      { id: req.params.id },
      { $set: { requiredDocuments: nextDocuments } },
      { new: true }
    ).lean();

    await createAuditLog({
      action: "document.verified",
      entityType: "user",
      entityId: updated.id,
      title: "Document review updated",
      summary: `${document.title} marked as ${req.body.status}.`,
      actor: req.admin,
      metadata: { documentId: document.id, title: document.title, status: req.body.status },
    });

    return ok(res, serializeUser(updated).requiredDocuments || [], "Document status updated.");
  }
);
