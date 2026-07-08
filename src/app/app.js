import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "../config.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { requestsRouter } from "../modules/requests/requests.routes.js";
import { usersRouter } from "../modules/users/users.routes.js";
import { ordersRouter } from "../modules/orders/orders.routes.js";
import { siteRouter } from "../modules/site/site.routes.js";
import { adminRouter } from "../modules/admin/admin.routes.js";
import { notificationsRouter } from "../modules/notifications/notifications.routes.js";
import { messagesRouter } from "../modules/messages/messages.routes.js";
import { paymentsRouter } from "../modules/payments/payments.routes.js";
import { auditRouter } from "../modules/audit/audit.routes.js";
import { filesRouter } from "../modules/files/files.routes.js";
import { reportsRouter } from "../modules/reports/reports.routes.js";
import { ok } from "../shared/http/respond.js";
import {
  errorHandler,
  notFoundHandler,
} from "../shared/middleware/error-handler.js";
import { attachRequestContext } from "../shared/middleware/request-context.js";
import { apiRateLimit } from "../shared/middleware/rate-limit.js";
import { handleUploadErrors } from "../shared/storage/upload.js";

const vercelPreviewRegex = /^https:\/\/[a-z0-9-]+(-[a-z0-9-]+)?\.vercel\.app$/i;
const localhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

const matchesWildcardPattern = (origin, pattern) => {
  if (!pattern.includes("*")) return false;
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, "[a-z0-9-]+");
  return new RegExp(`^${escaped}$`, "i").test(origin);
};

const matchesVercelPattern = (origin, base) => {
  if (!base.startsWith("https://") || !base.endsWith(".vercel.app")) {
    return false;
  }
  const trimmed = base.replace(/^https:\/\//, "").replace(/\.vercel\.app$/, "");
  if (!trimmed) return false;
  const regex = new RegExp(
    `^https://${trimmed
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/-/g, "[a-z0-9-]+")}(-git|-[a-z0-9-]+)?\\.vercel\\.app$`,
    "i"
  );
  return regex.test(origin);
};

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (config.corsOrigins.includes(origin)) return true;

  if (config.nodeEnv !== "production" && localhostRegex.test(origin)) {
    return true;
  }

  if (vercelPreviewRegex.test(origin)) {
    const adminBase = config.adminAppUrl || "";
    const clientBase = config.clientAppUrl || "";
    if (adminBase && matchesVercelPattern(origin, adminBase)) return true;
    if (clientBase && matchesVercelPattern(origin, clientBase)) return true;

    for (const pattern of config.corsOrigins) {
      if (matchesWildcardPattern(origin, pattern)) return true;
      if (matchesVercelPattern(origin, pattern)) return true;
    }

    const allowedProduction = config.corsOrigins.some((entry) =>
      entry.endsWith(".vercel.app") || entry.includes("notarix")
    );
    if (allowedProduction) {
      return true;
    }
  }

  return false;
};

export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");
  app.use(attachRequestContext);
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    })
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) {
          return callback(null, true);
        }
        return callback(new Error("Origin is not allowed by CORS."));
      },
      credentials: true,
    })
  );
  app.use(apiRateLimit);
  app.use(express.json({ limit: "2mb" }));
  app.get("/health", (_req, res) =>
    ok(res, { service: "notarix-backend", status: "ok" })
  );

  app.use(config.apiPrefix, authRouter);
  app.use(config.apiPrefix, requestsRouter);
  app.use(config.apiPrefix, usersRouter);
  app.use(config.apiPrefix, ordersRouter);
  app.use(config.apiPrefix, adminRouter);
  app.use(config.apiPrefix, siteRouter);
  app.use(config.apiPrefix, notificationsRouter);
  app.use(config.apiPrefix, messagesRouter);
  app.use(config.apiPrefix, paymentsRouter);
  app.use(config.apiPrefix, auditRouter);
  app.use(config.apiPrefix, filesRouter);
  app.use(config.apiPrefix, reportsRouter);

  app.use(handleUploadErrors);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
