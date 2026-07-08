import { verifyToken } from "../../auth.js";
import { AdminModel } from "../../modules/users/admin.model.js";
import { UserModel } from "../../modules/users/user.model.js";
import { fail } from "./respond.js";

const getAuthPayload = (req) => {
  const header = req.headers.authorization || "";
  const headerToken = header.startsWith("Bearer ") ? header.slice(7) : "";
  // For asset URLs that are loaded by the browser via <img>/<iframe>, the
  // Authorization header isn't attached. Accept the token via the `token`
  // query string as an escape hatch for those proxy endpoints.
  const queryToken = typeof req.query?.token === "string" ? req.query.token : "";
  const token = headerToken || queryToken;
  return verifyToken(token);
};

export const requireAdminAuth = async (req, res, next) => {
  const auth = getAuthPayload(req);

  if (!auth?.uid) {
    return fail(res, 401, "UNAUTHORIZED", "Unauthorized. Please sign in again.");
  }

  const admin = await AdminModel.findOne({ id: auth.uid }).lean();

  if (!admin) {
    return fail(res, 401, "UNAUTHORIZED", "Admin session is no longer valid.");
  }

  if (admin.status === "Suspended") {
    return fail(res, 403, "FORBIDDEN", "This admin account is suspended.");
  }

  req.admin = admin;
  next();
};

export const requireAdminRole = (...allowedRoles) => (req, res, next) => {
  if (!req.admin) {
    return fail(res, 401, "UNAUTHORIZED", "Unauthorized. Please sign in again.");
  }

  if (!allowedRoles.includes(req.admin.role)) {
    return fail(res, 403, "FORBIDDEN", "You do not have permission to perform this action.");
  }

  next();
};

export const requireAuthenticatedActor = async (req, res, next) => {
  const auth = getAuthPayload(req);

  if (!auth?.uid) {
    return fail(res, 401, "UNAUTHORIZED", "Unauthorized. Please sign in again.");
  }

  const admin = await AdminModel.findOne({ id: auth.uid }).lean();
  if (admin) {
    if (admin.status === "Suspended") {
      return fail(res, 403, "FORBIDDEN", "This admin account is suspended.");
    }

    req.actor = {
      id: admin.id,
      role: admin.role,
      type: "admin",
      record: admin,
    };
    return next();
  }

  const user = await UserModel.findOne({ id: auth.uid }).lean();
  if (!user) {
    return fail(res, 401, "UNAUTHORIZED", "User session is no longer valid.");
  }

  req.actor = {
    id: user.id,
    role: user.role,
    type: "user",
    record: user,
  };
  return next();
};
