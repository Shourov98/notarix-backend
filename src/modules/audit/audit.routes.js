import { Router } from "express";
import { z } from "zod";
import { requireAdminAuth } from "../../shared/http/auth-middleware.js";
import { ok } from "../../shared/http/respond.js";
import { validate } from "../../shared/middleware/validate.js";
import { AuditLogModel } from "./audit-log.model.js";

export const auditRouter = Router();

const listAuditSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    search: z.string().optional(),
    action: z.string().optional(),
    entityType: z.string().optional(),
  }).passthrough(),
  params: z.object({}).passthrough(),
});

auditRouter.get(
  "/admin/audit-logs",
  requireAdminAuth,
  validate(listAuditSchema),
  async (req, res) => {
    const query = {};

    if (req.query.action) {
      query.action = new RegExp(`^${req.query.action}$`, "i");
    }

    if (req.query.entityType) {
      query.entityType = new RegExp(`^${req.query.entityType}$`, "i");
    }

    if (req.query.search) {
      query.$or = [
        { title: { $regex: req.query.search, $options: "i" } },
        { summary: { $regex: req.query.search, $options: "i" } },
        { entityId: { $regex: req.query.search, $options: "i" } },
        { actorId: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const items = await AuditLogModel.find(query)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    return ok(res, items);
  }
);
