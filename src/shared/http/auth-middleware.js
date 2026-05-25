import { verifyToken } from "../../auth.js";
import { readStore } from "../../store.js";
import { fail } from "./respond.js";

const getAuthPayload = (req) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return verifyToken(token);
};

export const requireAdminAuth = async (req, res, next) => {
  const auth = getAuthPayload(req);

  if (!auth?.uid) {
    return fail(res, 401, "UNAUTHORIZED", "Unauthorized. Please sign in again.");
  }

  const store = await readStore();
  const admin = store.admins.find((item) => item.id === auth.uid);

  if (!admin) {
    return fail(res, 401, "UNAUTHORIZED", "Admin session is no longer valid.");
  }

  req.admin = admin;
  next();
};
