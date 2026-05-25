import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { mutateStore, readStore } from "../../store.js";
import {
  requireAdminAuth,
  requireAdminRole,
} from "../../shared/http/auth-middleware.js";
import { fail, ok } from "../../shared/http/respond.js";
import { validate } from "../../shared/middleware/validate.js";
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

const createDocumentRecord = (document) => ({
  id: document.id || `doc-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
  title: document.title,
  status: document.status || (document.file ? "Pending" : "Missing"),
  file: document.file || null,
  mimeType: document.mimeType,
  size: document.size,
});

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

  return ok(res, user);
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

usersRouter.post("/admin/users/notary", requireAdminAuth, async (req, res) => {
  const email = String(req.body?.loginEmail || req.body?.personalInfo?.email || "").trim().toLowerCase();
  const name = String(req.body?.personalInfo?.fullName || "New Notary");

  const newUser = {
    id: `notary-${Date.now()}`,
    name,
    email,
    role: "Notary",
    company: name,
    area: req.body?.address?.state || "Unknown",
    status: "Pending",
    verification: "Pending",
    avatarTone: "bg-orange-100 text-orange-700",
    commission: req.body?.commission || {},
    address: req.body?.address || {},
    requiredDocuments: req.body?.requiredDocuments || [],
  };

  await mutateStore((store) => {
    store.users.unshift(newUser);
  });

  return ok(
    res,
    {
      userId: newUser.id,
      role: newUser.role,
      status: newUser.status,
      verified: false,
      passwordResetRequired: true,
    },
    "Notary created successfully",
    201
  );
});

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
    const updated = await mutateStore((store) => {
      const user = store.users.find((item) => item.id === req.params.id);
      if (!user) {
        return null;
      }

      const nextDocuments = files.map((file) => ({
        title: file.originalname,
        status: "Pending",
        file: file.filename,
        mimeType: file.mimetype,
        size: file.size,
      }));

      user.requiredDocuments = [...(user.requiredDocuments || []), ...nextDocuments];
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
