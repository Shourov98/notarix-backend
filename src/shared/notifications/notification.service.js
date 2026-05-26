import { NotificationModel } from "./notification.model.js";

export const createNotification = async ({
  title,
  meta,
  action,
  audience = "admin",
  entityType = null,
  entityId = null,
}) => {
  const notification = {
    id: `notif-${Date.now()}`,
    title,
    meta,
    action,
    audience,
    entityType,
    entityId,
    createdAt: new Date().toISOString(),
    read: false,
  };

  await NotificationModel.create(notification);

  return notification;
};
