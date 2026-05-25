import express from "express";
import cors from "cors";
import { config } from "../config.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { requestsRouter } from "../modules/requests/requests.routes.js";
import { usersRouter } from "../modules/users/users.routes.js";
import { ordersRouter } from "../modules/orders/orders.routes.js";
import { siteRouter } from "../modules/site/site.routes.js";
import { adminRouter } from "../modules/admin/admin.routes.js";
import { fail, ok } from "../shared/http/respond.js";

export const createApp = () => {
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
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

  app.use((req, res) =>
    fail(res, 404, "NOT_FOUND", `No route matched ${req.method} ${req.originalUrl}`)
  );

  return app;
};
