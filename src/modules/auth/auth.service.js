import { createRefreshToken, createToken } from "../../auth.js";
import { mutateStore, readStore } from "../../store.js";

const buildAdminAuthPayload = (admin) => {
  const accessToken = createToken({
    uid: admin.id,
    email: admin.email,
    role: admin.role,
    is_verified: admin.isVerified,
  });
  const refreshToken = createRefreshToken();

  return {
    uid: admin.id,
    email: admin.email,
    role: admin.role,
    is_verified: admin.isVerified,
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 60 * 60 * 12,
  };
};

export const loginAdmin = async ({ email, password }) => {
  const store = await readStore();
  const admin = store.admins.find((item) => item.email === email);

  if (!admin || admin.password !== password) {
    return null;
  }

  const authPayload = buildAdminAuthPayload(admin);

  await mutateStore((draft) => {
    const target = draft.admins.find((item) => item.id === admin.id);
    target.refreshToken = authPayload.refresh_token;
    target.lastSignInAt = new Date().toISOString();
  });

  return authPayload;
};

export const issueForgotPasswordOtp = async (email) => {
  const store = await readStore();
  const admin = store.admins.find((item) => item.email === email);

  if (!admin) {
    return null;
  }

  await mutateStore((draft) => {
    const target = draft.admins.find((item) => item.id === admin.id);
    target.forgotOtp = "1234";
    target.forgotOtpVerified = false;
  });

  return { email };
};

export const resendForgotPasswordOtp = async (email) => {
  await mutateStore((draft) => {
    const admin = draft.admins.find((item) => item.email === email);
    if (admin) {
      admin.forgotOtp = "1234";
      admin.forgotOtpVerified = false;
    }
  });

  return { email };
};

export const verifyForgotPasswordOtp = async ({ email, otp }) => {
  const store = await readStore();
  const admin = store.admins.find((item) => item.email === email);

  if (!admin || admin.forgotOtp !== otp) {
    return null;
  }

  await mutateStore((draft) => {
    const target = draft.admins.find((item) => item.id === admin.id);
    target.forgotOtpVerified = true;
  });

  return { email, is_verified: true };
};

export const resetAdminPassword = async ({ email, newPassword }) => {
  const store = await readStore();
  const admin = store.admins.find((item) => item.email === email);

  if (!admin || !admin.forgotOtpVerified) {
    return null;
  }

  await mutateStore((draft) => {
    const target = draft.admins.find((item) => item.id === admin.id);
    target.password = newPassword;
    target.forgotOtp = null;
    target.forgotOtpVerified = false;
  });

  return { email };
};

export const refreshAdminSession = async (refreshToken) => {
  const store = await readStore();
  const admin = store.admins.find((item) => item.refreshToken === refreshToken);

  if (!admin) {
    return null;
  }

  const authPayload = buildAdminAuthPayload(admin);

  await mutateStore((draft) => {
    const target = draft.admins.find((item) => item.id === admin.id);
    target.refreshToken = authPayload.refresh_token;
  });

  return authPayload;
};

export const changeAdminPassword = async ({ adminId, currentPassword, newPassword }) => {
  const store = await readStore();
  const admin = store.admins.find((item) => item.id === adminId);

  if (!admin || admin.password !== currentPassword) {
    return false;
  }

  await mutateStore((draft) => {
    const target = draft.admins.find((item) => item.id === adminId);
    target.password = newPassword;
  });

  return true;
};
