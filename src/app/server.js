import http from "node:http";
import { config } from "../config.js";
import { createApp } from "./app.js";
import { connectDatabase } from "../shared/db/connect.js";
import { initSocketServer } from "../shared/realtime/socket.js";
import { startEmailWorker } from "../workers/email.worker.js";

export const app = createApp();
export const httpServer = http.createServer(app);
export const io = initSocketServer(httpServer);

app.locals.io = io;

if (process.env.NOTARIX_DISABLE_LISTEN !== "true") {
  await connectDatabase();

  // Start the email worker alongside the API so queued emails are
  // actually delivered (SES in production, Gmail SMTP in development).
  const emailWorker = startEmailWorker();

  const shutdown = async (signal) => {
    // eslint-disable-next-line no-console
    console.log(`[server] received ${signal}, shutting down...`);
    try {
      await emailWorker.stop();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[server] email worker shutdown error: ${error?.message || error}`);
    }
    httpServer.close(() => process.exit(0));
    // Hard exit if not closed in 10s
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  httpServer.listen(config.port, () => {
    console.log(`Notarix backend listening on ${config.appUrl}`);
  });
}