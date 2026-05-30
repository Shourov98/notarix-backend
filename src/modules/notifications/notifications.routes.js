import { Router } from "express";
import { z } from "zod";
import { requireAuthenticatedActor } from "../../shared/http/auth-middleware.js";
import { fail, ok } from "../../shared/http/respond.js";
import { validate } from "../../shared/middleware/validate.js";
import { NotificationModel } from "../../shared/notifications/notification.model.js";

export const notificationsRouter = Router();

const listNotificationsSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    read: z.enum(["true", "false"]).optional(),
  }).passthrough(),
  params: z.object({}).passthrough(),
});

const notificationIdSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().min(1),
  }),
});

const resolveAudience = (actor) => {
  if (!actor) return null;
  if (actor.type === "admin") return "admin";
  if (actor.role === "Notary") return "notary";
  return "user";
};

const buildRecipientQuery = (actor) => {
  if (!actor) return {};
  if (actor.type === "admin") {
    return {
      $or: [
        { audience: "admin" },
        { recipientId: actor.id, recipientType: "admin" },
      ],
    };
  }

  return {
    recipientId: actor.id,
    recipientType: actor.type,
  };
};

notificationsRouter.get(
  "/notifications",
  requireAuthenticatedActor,
  validate(listNotificationsSchema),
  async (req, res) => {
    const query = buildRecipientQuery(req.actor);

    if (req.query.read === "true") {
      query.read = true;
    }
    if (req.query.read === "false") {
      query.read = false;
    }

    const notifications = await NotificationModel.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return ok(res, notifications);
  }
);

notificationsRouter.patch(
  "/notifications/:id/read",
  requireAuthenticatedActor,
  validate(notificationIdSchema),
  async (req, res) => {
    const updated = await NotificationModel.findOneAndUpdate(
      { id: req.params.id, ...buildRecipientQuery(req.actor) },
      { $set: { read: true } },
      { new: true }
    ).lean();

    if (!updated) {
      return fail(res, 404, "NOTIFICATION_NOT_FOUND", "Notification not found.");
    }

    return ok(res, updated, "Notification marked as read.");
  }
);

notificationsRouter.patch(
  "/notifications/read-all",
  requireAuthenticatedActor,
  async (req, res) => {
    await NotificationModel.updateMany(
      { ...buildRecipientQuery(req.actor), read: false },
      { $set: { read: true } }
    );

    return ok(res, { audience: resolveAudience(req.actor) }, "All notifications marked as read.");
  }
);
