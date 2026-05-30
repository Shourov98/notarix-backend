import { NotificationModel } from "./notification.model.js";
import { emitNotificationEvent } from "../realtime/socket.js";

export const createNotification = async ({
  title,
  meta,
  action,
  audience = "admin",
  recipientId = null,
  recipientType = null,
  entityType = null,
  entityId = null,
}) => {
  const notification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    meta,
    action,
    audience,
    recipientId,
    recipientType,
    entityType,
    entityId,
    createdAt: new Date().toISOString(),
    read: false,
  };

  await NotificationModel.create(notification);
  emitNotificationEvent(notification);

  return notification;
};
