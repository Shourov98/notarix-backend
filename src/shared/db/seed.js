import crypto from "node:crypto";
import { hashPassword } from "../security/password.js";
import { AdminModel } from "../../modules/users/admin.model.js";

const DEFAULT_SUPER_ADMIN_NAME = "Notarix Super Admin";
const DEFAULT_SUPER_ADMIN_EMAIL = "admin@notarix.io";
const DEFAULT_SUPER_ADMIN_PASSWORD = "Admin12345!";
const isProduction = (process.env.NODE_ENV || "development") === "production";

export const ensureSuperAdminSeed = async () => {
  const email = String(
    isProduction ? process.env.SUPER_ADMIN_EMAIL : process.env.SUPER_ADMIN_EMAIL || DEFAULT_SUPER_ADMIN_EMAIL
  )
    .trim()
    .toLowerCase();

  const existing = await AdminModel.findOne({ email }).lean();
  if (existing) {
    return existing;
  }

  const passwordHash = await hashPassword(
    String(
      isProduction
        ? process.env.SUPER_ADMIN_PASSWORD
        : process.env.SUPER_ADMIN_PASSWORD || DEFAULT_SUPER_ADMIN_PASSWORD
    )
  );

  const record = {
    id: `admin-${crypto.randomUUID().slice(0, 8)}`,
    name: String(process.env.SUPER_ADMIN_NAME || DEFAULT_SUPER_ADMIN_NAME).trim(),
    email,
    passwordHash,
    role: "super_admin",
    isVerified: true,
    passwordResetRequired: false,
    status: "Active",
    avatar: "/profile.jpg",
    phone: null,
    createdBy: "system",
  };

  await AdminModel.create(record);
  return record;
};
