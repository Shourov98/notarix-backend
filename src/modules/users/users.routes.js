import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { mutateStore, readStore } from "../../store.js";
import {
  requireAdminAuth,
  requireAuthenticatedActor,
  requireAdminRole,
} from "../../shared/http/auth-middleware.js";
import { fail, ok } from "../../shared/http/respond.js";
import { validate } from "../../shared/middleware/validate.js";
import { queueEmail } from "../../shared/notifications/email.service.js";
import {
  buildMaskedBankInfo,
  decryptBankInfo,
  encryptBankInfo,
} from "../../shared/security/bank-info.js";
import { hashPassword } from "../../shared/security/password.js";
import { upload } from "../../shared/storage/upload.js";

export const usersRouter = Router();

const adminCreateSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    role: z.enum(["admin", "super_admin"]).default("admin"),
    phone: z.string().min(7).optional(),
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

const serializeUser = (user) => {
  const {
    passwordHash,
    generatedPassword,
    bankInfoEncrypted,
    ...safeUser
  } = user;

  return {
    ...safeUser,
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
});

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

usersRouter.get("/admin/users", requireAdminAuth, async (req, res) => {
  const store = await readStore();
  const search = String(req.query.search || "").trim().toLowerCase();
  const role = String(req.query.role || "").trim().toLowerCase();
  const status = String(req.query.status || "").trim().toLowerCase();

  const filtered = store.users.filter((item) => {
    const matchesSearch =
      !search ||
      [item.name, item.email, item.company, item.area]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search));
    const matchesRole = !role || item.role.toLowerCase() === role;
    const matchesStatus = !status || item.status.toLowerCase() === status;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return ok(res, filtered);
});

usersRouter.get("/admin/users/:id", requireAdminAuth, async (req, res) => {
  const store = await readStore();
  const user = store.users.find((item) => item.id === req.params.id);

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
    const email = String(
      req.body?.loginEmail || req.body?.primaryContact?.email || ""
    )
      .trim()
      .toLowerCase();
    const name = String(req.body?.primaryContact?.name || "New Client");
    const company = String(
      req.body?.organization?.companyName || "New Organization"
    );
    const temporaryPassword = crypto.randomBytes(6).toString("base64url");
    const passwordHash = await hashPassword(temporaryPassword);

    const newUser = {
      id: `client-${Date.now()}`,
      name,
      email,
      passwordHash,
      passwordResetRequired: true,
      role: "Client",
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
      generatedPassword: temporaryPassword,
    };

    await mutateStore((store) => {
      store.users.unshift(newUser);
    });

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
    const email = String(
      req.body?.loginEmail || req.body?.personalInfo?.email || ""
    )
      .trim()
      .toLowerCase();
    const name = String(req.body?.personalInfo?.fullName || "New Notary");
    const temporaryPassword = crypto.randomBytes(6).toString("base64url");
    const passwordHash = await hashPassword(temporaryPassword);

    const newUser = {
      id: `notary-${Date.now()}`,
      name,
      email,
      passwordHash,
      passwordResetRequired: true,
      role: "Notary",
      company: name,
      area: req.body?.address?.state || "Unknown",
      status: "Pending",
      verification: "Pending",
      avatarTone: "bg-orange-100 text-orange-700",
      personalInfo: req.body?.personalInfo || {},
      commission: req.body?.commission || {},
      address: req.body?.address || {},
      requiredDocuments: (req.body?.requiredDocuments || []).map(createDocumentRecord),
      generatedPassword: temporaryPassword,
    };

    await mutateStore((store) => {
      store.users.unshift(newUser);
    });

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
    const store = await readStore();
    const email = String(req.body.email || "").trim().toLowerCase();

    const existingAdmin = store.admins.find((item) => item.email === email);

    if (existingAdmin) {
      return fail(res, 409, "ADMIN_ALREADY_EXISTS", "An admin with that email already exists.");
    }

    const temporaryPassword = crypto.randomBytes(6).toString("base64url");
    const passwordHash = await hashPassword(temporaryPassword);

    const newAdmin = {
      id: `admin-${Date.now()}`,
      name: req.body.name.trim(),
      email,
      passwordHash,
      role: req.body.role,
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

    await mutateStore((draft) => {
      draft.admins.push(newAdmin);
    });

    return ok(
      res,
      {
        adminId: newAdmin.id,
        email: newAdmin.email,
        role: newAdmin.role,
        passwordResetRequired: true,
        temporaryPassword,
      },
      "Admin created successfully.",
      201
    );
  }
);

usersRouter.patch("/admin/users/:id/status", requireAdminAuth, async (req, res) => {
  const nextStatus = String(req.body?.status || "");
  const updated = await mutateStore((store) => {
    const user = store.users.find((item) => item.id === req.params.id);
    if (!user) {
      return null;
    }
    user.status = nextStatus || user.status;
    return user;
  });

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

    const current = await readStore();
    const existingUser = current.users.find((item) => item.id === req.actor.id);
    if (existingUser?.bankInfoEncrypted) {
      return fail(
        res,
        409,
        "BANK_INFO_ALREADY_EXISTS",
        "Bank info already exists. Use update instead."
      );
    }

    const encrypted = encryptBankInfo(req.body);
    const updated = await mutateStore((store) => {
      const user = store.users.find((item) => item.id === req.actor.id);
      if (!user) {
        return null;
      }

      user.bankInfoEncrypted = encrypted.encrypted;
      user.bankInfoMasked = encrypted.masked;
      user.bankInfoUpdatedAt = new Date().toISOString();
      return user;
    });

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
    const updated = await mutateStore((store) => {
      const user = store.users.find((item) => item.id === req.actor.id);
      if (!user) {
        return null;
      }

      user.bankInfoEncrypted = encrypted.encrypted;
      user.bankInfoMasked = encrypted.masked;
      user.bankInfoUpdatedAt = new Date().toISOString();
      return user;
    });

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

  const store = await readStore();
  const user = store.users.find((item) => item.id === req.actor.id);

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
  const store = await readStore();
  const user = store.users.find((item) => item.id === req.params.id);

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
  mutateStore((store) => {
    const user = store.users.find((item) => item.id === userId);
    if (!user) {
      return null;
    }

    user.status = nextStatus;
    return user;
  });

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
    const updated = await mutateStore((store) => {
      const user = store.users.find((item) => item.id === req.params.id);
      if (!user) {
        return null;
      }

      const existingDocuments = [...(user.requiredDocuments || [])];
      files.forEach((file, index) => {
        const title = documentTitles[index] || file.originalname;
        upsertRequiredDocument(
          existingDocuments,
          createDocumentRecord({
            title,
            status: "Pending",
            file: file.filename,
            mimeType: file.mimetype,
            size: file.size,
          })
        );
      });

      user.requiredDocuments = existingDocuments;
      return user;
    });

    if (!updated) {
      return fail(res, 404, "USER_NOT_FOUND", "User not found.");
    }

    return ok(res, updated.requiredDocuments, "Documents uploaded successfully.", 201);
  }
);

usersRouter.get("/admin/users/:id/documents", requireAdminAuth, async (req, res) => {
  const store = await readStore();
  const user = store.users.find((item) => item.id === req.params.id);

  if (!user) {
    return fail(res, 404, "USER_NOT_FOUND", "User not found.");
  }

  return ok(res, user.requiredDocuments || []);
});

usersRouter.patch(
  "/admin/users/:id/documents/:documentId/status",
  requireAdminAuth,
  validate(userDocumentStatusSchema),
  async (req, res) => {
    const updated = await mutateStore((store) => {
      const user = store.users.find((item) => item.id === req.params.id);
      if (!user) {
        return null;
      }

      const document = (user.requiredDocuments || []).find(
        (item) => item.id === req.params.documentId
      );

      if (!document) {
        return false;
      }

      document.status = req.body.status;
      if (req.body.status === "Missing") {
        document.file = null;
        document.mimeType = undefined;
        document.size = undefined;
      }
      return user;
    });

    if (updated === null) {
      return fail(res, 404, "USER_NOT_FOUND", "User not found.");
    }

    if (updated === false) {
      return fail(res, 404, "DOCUMENT_NOT_FOUND", "Document not found.");
    }

    return ok(res, updated.requiredDocuments || [], "Document status updated.");
  }
);
