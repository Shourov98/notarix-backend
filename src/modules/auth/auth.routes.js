import { Router } from "express";
import {
  changeAdminPassword,
  issueForgotPasswordOtp,
  loginAdmin,
  refreshAdminSession,
  resendForgotPasswordOtp,
  resetAdminPassword,
  verifyForgotPasswordOtp,
} from "./auth.service.js";
import { ok, fail } from "../../shared/http/respond.js";
import { requireAdminAuth } from "../../shared/http/auth-middleware.js";
import { validate } from "../../shared/middleware/validate.js";
import {
  changePasswordSchema,
  emailSchema,
  loginSchema,
  refreshSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from "./auth.schemas.js";

export const authRouter = Router();

authRouter.post("/admin/auth/login", validate(loginSchema), async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const authPayload = await loginAdmin({ email, password });

  if (!authPayload) {
    return fail(res, 401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }

  return ok(res, authPayload, "Login successful");
});

authRouter.post("/admin/auth/forgot-password", validate(emailSchema), async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const result = await issueForgotPasswordOtp(email);

  if (!result) {
    return fail(res, 404, "ADMIN_NOT_FOUND", "No admin account exists for that email.");
  }

  return ok(res, result, "Verification code sent. Use 1234 in local development.");
});

authRouter.post("/admin/auth/resend-forgot-otp", validate(emailSchema), async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const result = await resendForgotPasswordOtp(email);
  return ok(res, result, "Verification code resent. Use 1234 in local development.");
});

authRouter.post("/admin/auth/verify-forgot-otp", validate(verifyOtpSchema), async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const otp = String(req.body?.otp || "").trim();
  const result = await verifyForgotPasswordOtp({ email, otp });

  if (!result) {
    return fail(res, 400, "INVALID_OTP", "The verification code is invalid.");
  }

  return ok(res, result, "Verification successful.");
});

authRouter.post("/admin/auth/reset-password", validate(resetPasswordSchema), async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const newPassword = String(req.body?.new_password || "");
  const result = await resetAdminPassword({ email, newPassword });

  if (!result) {
    return fail(res, 400, "RESET_NOT_ALLOWED", "OTP verification is required before resetting the password.");
  }

  return ok(res, result, "Password has been reset successfully.");
});

authRouter.post("/admin/auth/refresh", validate(refreshSchema), async (req, res) => {
  const refreshToken = String(req.body?.refreshToken || "");
  const result = await refreshAdminSession(refreshToken);

  if (!result) {
    return fail(res, 401, "INVALID_REFRESH_TOKEN", "Session refresh failed.");
  }

  return ok(res, result, "Session refreshed.");
});

authRouter.patch("/admin/change-password", requireAdminAuth, validate(changePasswordSchema), async (req, res) => {
  const currentPassword = String(req.body?.current_password || "");
  const newPassword = String(req.body?.new_password || "");

  const changed = await changeAdminPassword({
    adminId: req.admin.id,
    currentPassword,
    newPassword,
  });

  if (!changed) {
    return fail(res, 400, "INVALID_PASSWORD", "Current password is incorrect.");
  }

  return ok(res, { ok: true }, "Password updated successfully.");
});
