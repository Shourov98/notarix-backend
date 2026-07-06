import { EmailJobModel } from "../shared/notifications/email-job.model.js";
import { sendQueuedEmail, getActiveProvider } from "../shared/notifications/email.service.js";

/**
 * Background worker that drains the email queue.
 *
 * Polls the `emailjobs` collection for jobs with status=`queued`
 * and sends them through the active provider (SES in prod,
 * Gmail SMTP in dev). Failed jobs are marked `failed` and left
 * for inspection; successful jobs are marked `sent`.
 *
 * The worker is single-instance per process. Set
 * EMAIL_WORKER_DISABLED=true to opt out (useful for tests).
 */

const POLL_INTERVAL_MS = Number(process.env.EMAIL_WORKER_INTERVAL_MS) || 5000;
const BATCH_SIZE = Number(process.env.EMAIL_WORKER_BATCH_SIZE) || 10;
const MAX_ATTEMPTS = Number(process.env.EMAIL_WORKER_MAX_ATTEMPTS) || 3;

let timer = null;
let running = false;
let stopped = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const processBatch = async () => {
  const jobs = await EmailJobModel.find({ status: "queued" })
    .sort({ createdAt: 1 })
    .limit(BATCH_SIZE)
    .exec();

  for (const job of jobs) {
    if (job.attempts >= MAX_ATTEMPTS) {
      job.status = "failed";
      job.lastError = `Exceeded max attempts (${MAX_ATTEMPTS})`;
      await job.save();
      continue;
    }

    // Mark as sending so concurrent workers don't double-send
    job.status = "sending";
    job.attempts = (job.attempts || 0) + 1;
    await job.save();

    try {
      await sendQueuedEmail(job);
    } catch {
      // sendQueuedEmail already recorded the error on the job.
    }
  }
};

const tick = async () => {
  if (running || stopped) return;
  running = true;
  try {
    await processBatch();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[email-worker] tick failed: ${error?.message || error}`);
  } finally {
    running = false;
  }
};

export const startEmailWorker = () => {
  if (process.env.EMAIL_WORKER_DISABLED === "true") {
    // eslint-disable-next-line no-console
    console.log("[email-worker] disabled via EMAIL_WORKER_DISABLED");
    return { stop: async () => {} };
  }

  // eslint-disable-next-line no-console
  console.log(
    `[email-worker] starting (provider=${getActiveProvider()}, poll=${POLL_INTERVAL_MS}ms, batch=${BATCH_SIZE}, maxAttempts=${MAX_ATTEMPTS})`
  );

  const loop = async () => {
    while (!stopped) {
      await tick();
      await sleep(POLL_INTERVAL_MS);
    }
  };

  // Fire and forget — don't await (runs forever)
  loop();

  return {
    stop: async () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      // Wait briefly for current tick to finish
      while (running) await sleep(50);
      // eslint-disable-next-line no-console
      console.log("[email-worker] stopped");
    },
  };
};
