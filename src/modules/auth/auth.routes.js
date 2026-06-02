import { Router } from "express";
import {
  changeAdminPassword,
  firstLoginResetPassword,
  firstLoginResetPortalPassword,
  getCurrentAdmin,
  issueForgotPasswordOtp,
  loginAdmin,
  loginPortalUser,
  logoutAdmin,
  refreshAdminSession,
  resendForgotPasswordOtp,
  resetAdminPassword,
  verifyForgotPasswordOtp,
} from "./auth.service.js";
import { ok, fail } from "../../shared/http/respond.js";
import {
  requireAdminAuth,
  requireAuthenticatedActor,
} from "../../shared/http/auth-middleware.js";
import { authRateLimit } from "../../shared/middleware/rate-limit.js";
import { validate } from "../../shared/middleware/validate.js";
import {
  changePasswordSchema,
  emailSchema,
  firstLoginResetSchema,
  loginSchema,
  logoutSchema,
  portalLoginSchema,
  refreshSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from "./auth.schemas.js";

export const authRouter = Router();

authRouter.post("/admin/auth/login", authRateLimit, validate(loginSchema), async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const authPayload = await loginAdmin({ email, password });

  if (!authPayload) {
    return fail(res, 401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }

  return ok(res, authPayload, "Login successful");
});

authRouter.post("/site/auth/login", authRateLimit, validate(portalLoginSchema), async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const role = String(req.body?.role || "").trim().toLowerCase();
  const authPayload = await loginPortalUser({ email, password, role });

  if (!authPayload) {
    return fail(res, 401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }

  return ok(res, authPayload, "Login successful");
});

authRouter.post("/admin/auth/logout", authRateLimit, requireAdminAuth, validate(logoutSchema), async (req, res) => {
  await logoutAdmin({
    adminId: req.admin.id,
    refreshToken: req.body?.refreshToken,
  });

  return ok(res, { ok: true }, "Logout successful.");
});

authRouter.post("/admin/auth/forgot-password", authRateLimit, validate(emailSchema), async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const result = await issueForgotPasswordOtp(email);

  if (!result) {
    return fail(res, 404, "ADMIN_NOT_FOUND", "No admin account exists for that email.");
  }

  return ok(res, result, "Verification code sent. Use 1234 in local development.");
});

authRouter.post("/admin/auth/resend-forgot-otp", authRateLimit, validate(emailSchema), async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const result = await resendForgotPasswordOtp(email);
  return ok(res, result, "Verification code resent. Use 1234 in local development.");
});

authRouter.post("/admin/auth/verify-forgot-otp", authRateLimit, validate(verifyOtpSchema), async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const otp = String(req.body?.otp || "").trim();
  const result = await verifyForgotPasswordOtp({ email, otp });

  if (!result) {
    return fail(res, 400, "INVALID_OTP", "The verification code is invalid.");
  }

  return ok(res, result, "Verification successful.");
});

authRouter.post("/admin/auth/reset-password", authRateLimit, validate(resetPasswordSchema), async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const newPassword = String(req.body?.new_password || "");
  const result = await resetAdminPassword({ email, newPassword });

  if (!result) {
    return fail(res, 400, "RESET_NOT_ALLOWED", "OTP verification is required before resetting the password.");
  }

  return ok(res, result, "Password has been reset successfully.");
});

authRouter.post("/admin/auth/refresh", authRateLimit, validate(refreshSchema), async (req, res) => {
  const refreshToken = String(req.body?.refreshToken || "");
  const result = await refreshAdminSession(refreshToken);

  if (!result) {
    return fail(res, 401, "INVALID_REFRESH_TOKEN", "Session refresh failed.");
  }

  return ok(res, result, "Session refreshed.");
});

authRouter.patch("/admin/change-password", authRateLimit, requireAdminAuth, validate(changePasswordSchema), async (req, res) => {
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

authRouter.patch(
  "/auth/reset-password",
  authRateLimit,
  requireAdminAuth,
  validate(firstLoginResetSchema),
  async (req, res) => {
    await firstLoginResetPassword({
      adminId: req.admin.id,
      newPassword: req.body.new_password,
    });

    return ok(
      res,
      { ok: true },
      "Password updated successfully. Please login again."
    );
  }
);

authRouter.patch(
  "/site/auth/reset-password",
  authRateLimit,
  requireAuthenticatedActor,
  validate(firstLoginResetSchema),
  async (req, res) => {
    if (req.actor.type !== "user") {
      return fail(res, 403, "FORBIDDEN", "Only portal users can reset password here.");
    }

    await firstLoginResetPortalPassword({
      userId: req.actor.id,
      newPassword: req.body.new_password,
    });

    return ok(
      res,
      { ok: true },
      "Password updated successfully. Please login again."
    );
  }
);

authRouter.get("/auth/me", requireAdminAuth, async (req, res) => {
  const currentAdmin = await getCurrentAdmin(req.admin.id);

  if (!currentAdmin) {
    return fail(res, 404, "ADMIN_NOT_FOUND", "Admin not found.");
  }

  return ok(res, currentAdmin);
});
