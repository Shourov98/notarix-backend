import { createRefreshToken, createToken } from "../../auth.js";
import { comparePassword, hashPassword } from "../../shared/security/password.js";
import { AdminModel } from "../users/admin.model.js";
import { UserModel } from "../users/user.model.js";

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
  const admin = await AdminModel.findOne({ email }).lean();

  const passwordMatches = admin?.passwordHash
    ? await comparePassword(password, admin.passwordHash)
    : false;

  if (!admin || !passwordMatches || admin.status === "Suspended") {
    return null;
  }

  const authPayload = buildAdminAuthPayload(admin);

  await AdminModel.updateOne(
    { id: admin.id },
    {
      $set: {
        refreshToken: authPayload.refresh_token,
        lastSignInAt: new Date(),
      },
    }
  );

  return authPayload;
};

export const loginPortalUser = async ({ email, password, role }) => {
  const expectedRole = role === "client" ? "Client" : "Notary";
  const user = await UserModel.findOne({ email, role: expectedRole }).lean();

  const passwordMatches = user?.passwordHash
    ? await comparePassword(password, user.passwordHash)
    : false;

  if (!user || !passwordMatches) {
    return null;
  }

  const authPayload = buildPortalAuthPayload(user);

  await UserModel.updateOne(
    { id: user.id },
    {
      $set: {
        refreshToken: authPayload.refresh_token,
        lastSignInAt: new Date(),
      },
    }
  );

  return authPayload;
};

export const issueForgotPasswordOtp = async (email) => {
  const admin = await AdminModel.findOne({ email }).lean();

  if (!admin) {
    return null;
  }

  await AdminModel.updateOne(
    { id: admin.id },
    {
      $set: {
        forgotOtp: "1234",
        forgotOtpVerified: false,
      },
    }
  );

  return { email };
};

export const resendForgotPasswordOtp = async (email) => {
  await AdminModel.updateOne(
    { email },
    {
      $set: {
        forgotOtp: "1234",
        forgotOtpVerified: false,
      },
    }
  );

  return { email };
};

export const verifyForgotPasswordOtp = async ({ email, otp }) => {
  const admin = await AdminModel.findOne({ email }).lean();

  if (!admin || admin.forgotOtp !== otp) {
    return null;
  }

  await AdminModel.updateOne(
    { id: admin.id },
    {
      $set: {
        forgotOtpVerified: true,
      },
    }
  );

  return { email, is_verified: true };
};

export const resetAdminPassword = async ({ email, newPassword }) => {
  const admin = await AdminModel.findOne({ email }).lean();

  if (!admin || !admin.forgotOtpVerified) {
    return null;
  }

  const nextHash = await hashPassword(newPassword);

  await AdminModel.updateOne(
    { id: admin.id },
    {
      $set: {
        passwordHash: nextHash,
        forgotOtp: null,
        forgotOtpVerified: false,
      },
    }
  );

  return { email };
};

export const logoutAdmin = async ({ adminId, refreshToken }) => {
  await AdminModel.updateMany(
    {
      $or: [
        { id: adminId },
        ...(refreshToken ? [{ refreshToken }] : []),
      ],
    },
    {
      $set: {
        refreshToken: null,
      },
    }
  );

  return { ok: true };
};

export const logoutPortalUser = async ({ userId, refreshToken }) => {
  await UserModel.updateMany(
    {
      $or: [
        { id: userId },
        ...(refreshToken ? [{ refreshToken }] : []),
      ],
    },
    {
      $set: {
        refreshToken: null,
      },
    }
  );

  return { ok: true };
};

export const refreshAdminSession = async (refreshToken) => {
  const admin = await AdminModel.findOne({ refreshToken }).lean();

  if (!admin || admin.status === "Suspended") {
    return null;
  }

  const authPayload = buildAdminAuthPayload(admin);

  await AdminModel.updateOne(
    { id: admin.id },
    {
      $set: {
        refreshToken: authPayload.refresh_token,
      },
    }
  );

  return authPayload;
};

export const changeAdminPassword = async ({ adminId, currentPassword, newPassword }) => {
  const admin = await AdminModel.findOne({ id: adminId }).lean();

  const matches = admin?.passwordHash
    ? await comparePassword(currentPassword, admin.passwordHash)
    : false;

  if (!admin || !matches) {
    return false;
  }

  const nextHash = await hashPassword(newPassword);

  await AdminModel.updateOne(
    { id: adminId },
    {
      $set: {
        passwordHash: nextHash,
      },
    }
  );

  return true;
};

export const changePortalPassword = async ({ userId, currentPassword, newPassword }) => {
  const user = await UserModel.findOne({ id: userId }).lean();

  const matches = user?.passwordHash
    ? await comparePassword(currentPassword, user.passwordHash)
    : false;

  if (!user || !matches) {
    return false;
  }

  const nextHash = await hashPassword(newPassword);

  await UserModel.updateOne(
    { id: userId },
    {
      $set: {
        passwordHash: nextHash,
        passwordResetRequired: false,
      },
    }
  );

  return true;
};

export const firstLoginResetPassword = async ({ adminId, newPassword }) => {
  const nextHash = await hashPassword(newPassword);

  await AdminModel.updateOne(
    { id: adminId },
    {
      $set: {
        passwordHash: nextHash,
        passwordResetRequired: false,
      },
    }
  );

  return { ok: true };
};

export const firstLoginResetPortalPassword = async ({ userId, newPassword }) => {
  const nextHash = await hashPassword(newPassword);

  await UserModel.updateOne(
    { id: userId },
    {
      $set: {
        passwordHash: nextHash,
        passwordResetRequired: false,
      },
    }
  );

  return { ok: true };
};

export const getCurrentAdmin = async (adminId) => {
  const admin = await AdminModel.findOne({ id: adminId }).lean();

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
