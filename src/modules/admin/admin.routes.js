import { Router } from "express";
import { readStore } from "../../store.js";
import { requireAdminAuth } from "../../shared/http/auth-middleware.js";
import { ok } from "../../shared/http/respond.js";
import { summarizeAdminConsole } from "../dashboard/dashboard.service.js";

export const adminRouter = Router();

adminRouter.get("/admin/console", requireAdminAuth, async (req, res) => {
  const store = await readStore();
  return ok(res, summarizeAdminConsole(store, req.admin));
});

adminRouter.get("/admin/dashboard/stats", requireAdminAuth, async (req, res) => {
  const store = await readStore();
  return ok(res, summarizeAdminConsole(store, req.admin).metrics);
});
