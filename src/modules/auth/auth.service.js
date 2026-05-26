import { createRefreshToken, createToken } from "../../auth.js";
import { mutateStore, readStore } from "../../store.js";
import { comparePassword, hashPassword } from "../../shared/security/password.js";

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

const buildPortalAuthPayload = (user) => {
  const accessToken = createToken({
    uid: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
  });
  const refreshToken = createRefreshToken();

  return {
    uid: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 60 * 60 * 12,
    passwordResetRequired: Boolean(user.passwordResetRequired),
  };
};

export const loginAdmin = async ({ email, password }) => {
  const store = await readStore();
  const admin = store.admins.find((item) => item.email === email);

  const passwordMatches = admin?.passwordHash
    ? await comparePassword(password, admin.passwordHash)
    : false;

  if (!admin || !passwordMatches) {
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

export const loginPortalUser = async ({ email, password, role }) => {
  const store = await readStore();
  const expectedRole = role === "client" ? "Client" : "Notary";
  const user = store.users.find(
    (item) => item.email === email && item.role === expectedRole
  );

  const passwordMatches = user?.passwordHash
    ? await comparePassword(password, user.passwordHash)
    : false;

  if (!user || !passwordMatches) {
    return null;
  }

  const authPayload = buildPortalAuthPayload(user);

  await mutateStore((draft) => {
    const target = draft.users.find((item) => item.id === user.id);
    if (target) {
      target.refreshToken = authPayload.refresh_token;
      target.lastSignInAt = new Date().toISOString();
    }
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
    target.passwordHash = null;
    target.forgotOtp = null;
    target.forgotOtpVerified = false;
  });

  const nextHash = await hashPassword(newPassword);

  await mutateStore((draft) => {
    const target = draft.admins.find((item) => item.id === admin.id);
    target.passwordHash = nextHash;
  });

  return { email };
};

export const logoutAdmin = async ({ adminId, refreshToken }) => {
  await mutateStore((draft) => {
    const target = draft.admins.find(
      (item) => item.id === adminId || (refreshToken && item.refreshToken === refreshToken)
    );

    if (target) {
      target.refreshToken = null;
    }
  });

  return { ok: true };
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

  const matches = admin?.passwordHash
    ? await comparePassword(currentPassword, admin.passwordHash)
    : false;

  if (!admin || !matches) {
    return false;
  }

  const nextHash = await hashPassword(newPassword);

  await mutateStore((draft) => {
    const target = draft.admins.find((item) => item.id === adminId);
    target.passwordHash = nextHash;
  });

  return true;
};

export const firstLoginResetPassword = async ({ adminId, newPassword }) => {
  const nextHash = await hashPassword(newPassword);

  await mutateStore((draft) => {
    const target = draft.admins.find((item) => item.id === adminId);
    if (target) {
      target.passwordHash = nextHash;
      target.passwordResetRequired = false;
    }
  });

  return { ok: true };
};

export const getCurrentAdmin = async (adminId) => {
  const store = await readStore();
  const admin = store.admins.find((item) => item.id === adminId);

  if (!admin) {
    return null;
  }

  return {
    uid: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    is_verified: admin.isVerified,
    passwordResetRequired: Boolean(admin.passwordResetRequired),
    lastSignInAt: admin.lastSignInAt,
  };
};
