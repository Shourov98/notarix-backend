import { Router } from "express";
import { readStore } from "../../store.js";
import { requireAdminAuth } from "../../shared/http/auth-middleware.js";
import { ok } from "../../shared/http/respond.js";
import { summarizeAdminConsole } from "../dashboard/dashboard.service.js";
import { AdminModel } from "../users/admin.model.js";
import { UserModel } from "../users/user.model.js";

export const adminRouter = Router();

adminRouter.get("/admin/console", requireAdminAuth, async (req, res) => {
  const [store, admins, users] = await Promise.all([
    readStore(),
    AdminModel.find().lean(),
    UserModel.find().lean(),
  ]);
  const snapshot = {
    ...store,
    admins,
    users,
  };
  return ok(res, summarizeAdminConsole(snapshot, req.admin));
});

adminRouter.get("/admin/dashboard/stats", requireAdminAuth, async (req, res) => {
  const [store, admins, users] = await Promise.all([
    readStore(),
    AdminModel.find().lean(),
    UserModel.find().lean(),
  ]);
  const snapshot = {
    ...store,
    admins,
    users,
  };
  return ok(res, summarizeAdminConsole(snapshot, req.admin).metrics);
});
