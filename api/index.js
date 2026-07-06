// Vercel serverless entry point for the Notarix backend.
//
// Vercel executes this file for every incoming request. We:
//   1. Lazily import the Express app (cold-start friendly)
//   2. Ensure the MongoDB connection is established and reused
//      (serverless reuses warm containers, so we cache the connection)
//   3. Hand the request off to Express
//
// ⚠️ VERCEL LIMITATIONS (apply ONLY when deployed to Vercel):
//
//   - No Socket.IO: serverless functions are stateless, so realtime
//     messaging is NOT available on Vercel. The Socket.IO module is
//     lazy-imported only when not running in serverless. Frontend
//     real-time features (live order updates, notifications) will
//     fall back to polling. For real-time, deploy to Render or Railway.
//
//   - File uploads: Vercel serverless has a 4.5 MB request body
//     limit on Hobby, 50 MB on Pro. Server-side multer uploads for
//     large files will fail. Workarounds:
//       * Use Cloudinary signed uploads from the browser (recommended)
//       * Increase MAX_FILE_SIZE_MB only on Render/Railway
//
//   - Email worker: not started in serverless (would be killed when
//     the function ends). Emails queued via queueEmail() will sit in
//     the database until manually processed. For real email delivery
//     on Vercel, add a Vercel Cron job that calls a /api/cron/email
//     endpoint to drain the queue.
//
//   - 10-second timeout on Hobby, 60s on Pro. Long-running tasks
//     (large file processing, many DB queries) may hit the limit.

import { connectDatabase } from "../src/shared/db/connect.js";

let appPromise = null;

const getApp = async () => {
  if (!appPromise) {
    appPromise = (async () => {
      const mod = await import("../src/app/server.js");
      return mod.app;
    })();
  }
  return appPromise;
};

const handler = async (req, res) => {
  // Establish DB connection once per cold start, reuse on warm invocations
  try {
    await connectDatabase();
  } catch (err) {
    // If Mongo is unreachable, return 503 instead of crashing
    // eslint-disable-next-line no-console
    console.error(`[vercel] DB connect failed: ${err.message}`);
    res.status(503).json({
      error: "Database unavailable",
      message: err.message,
    });
    return;
  }

  const app = await getApp();
  return app(req, res);
};

export default handler;

// Configure Vercel function timeout (max 60s on Pro, 10s on Hobby).
// Must be named `config` per Vercel's serverless function spec.
export const config = {
  maxDuration: 60,
};
