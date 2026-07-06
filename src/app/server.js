import http from "node:http";
import { config } from "../config.js";
import { createApp } from "./app.js";
import { connectDatabase } from "../shared/db/connect.js";
import { startEmailWorker } from "../workers/email.worker.js";

// Detect serverless environment (Vercel sets VERCEL=1).
// In serverless we must not call httpServer.listen(), and we must not
// initialize Socket.IO (serverless functions are stateless). We also
// avoid starting the in-process email worker because it relies on a
// long-running process — Vercel functions time out.
const isServerless = process.env.VERCEL === "1" || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

export const app = createApp();

// Only attach HTTP server + Socket.IO in long-running environments
let httpServer = null;
if (!isServerless) {
  httpServer = http.createServer(app);
  // Lazy-import Socket.IO so importing server.js in serverless
  // environments does not pull in the Socket.IO dependency graph
  // unnecessarily (it requires a real HTTP server).
  const { initSocketServer } = await import("../shared/realtime/socket.js");
  const io = initSocketServer(httpServer);
  app.locals.io = io;
}

export { httpServer };

if (process.env.NOTARIX_DISABLE_LISTEN !== "true" && !isServerless) {
  await connectDatabase();

  // Start the email worker alongside the API so queued emails are
  // actually delivered (SES in production, Gmail SMTP in development).
  // Skipped in serverless (Vercel) — the worker would not run anyway.
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
    if (httpServer) {
      httpServer.close(() => process.exit(0));
    } else {
      process.exit(0);
    }
    // Hard exit if not closed in 10s
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  if (httpServer) {
    httpServer.listen(config.port, () => {
      console.log(`Notarix backend listening on ${config.appUrl}`);
    });
  }
}
