import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import nodemailer from "nodemailer";
import { EmailJobModel } from "./email-job.model.js";

/**
 * Email delivery service.
 *
 * Provider selection (priority):
 *   1. Explicit override via EMAIL_PROVIDER=ses|gmail|console
 *   2. NODE_ENV=production  -> AWS SES
 *   3. NODE_ENV=development -> Gmail SMTP (fallback for local dev)
 *   4. No credentials       -> console (no-op, useful for tests)
 *
 * Public API (kept stable for all callers):
 *   queueEmail({ to, subject, html, text, category }) -> persists to DB
 *   sendEmailNow({ to, subject, html, text, category }) -> sends immediately
 *   sendQueuedEmail(job)                                -> sends a queued job
 *   getActiveProvider()                                 -> "ses" | "gmail" | "console"
 */

const isProduction = (process.env.NODE_ENV || "development") === "production";

const resolveProvider = () => {
  const override = String(process.env.EMAIL_PROVIDER || "").toLowerCase().trim();
  if (override === "ses" || override === "gmail" || override === "console") {
    return override;
  }
  // Production: prefer SES only if AWS creds are present; otherwise
  // fall back to Gmail SMTP so the MVP can send real email without
  // AWS access. Dev: Gmail if creds present, else console.
  if (isProduction) {
    if (process.env.AWS_SES_FROM_EMAIL && process.env.AWS_ACCESS_KEY_ID) {
      return "ses";
    }
    if (process.env.SMTP_USER && process.env.SMTP_PASS) return "gmail";
    return "console";
  }
  if (process.env.SMTP_USER && process.env.SMTP_PASS) return "gmail";
  return "console";
};

const getFromAddress = () => {
  const fromName = process.env.EMAIL_FROM_NAME || "Notarix";
  const fromAddress =
    process.env.EMAIL_FROM_ADDRESS ||
    process.env.AWS_SES_FROM_EMAIL ||
    "no-reply@notarix.live";
  return `${fromName} <${fromAddress}>`;
};

const getReplyTo = () =>
  process.env.EMAIL_REPLY_TO ||
  process.env.AWS_SES_REPLY_TO ||
  process.env.EMAIL_FROM_ADDRESS ||
  "support@notarix.live";

let sesClient = null;
const getSesClient = () => {
  if (sesClient) return sesClient;
  const region = process.env.AWS_SES_REGION || process.env.AWS_REGION || "us-east-1";
  sesClient = new SESv2Client({ region });
  return sesClient;
};

let gmailTransporter = null;
const getGmailTransporter = () => {
  if (gmailTransporter) return gmailTransporter;
  gmailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return gmailTransporter;
};

const sendViaSes = async ({ to, subject, html, text }) => {
  const client = getSesClient();
  const fromAddress =
    process.env.AWS_SES_FROM_EMAIL || process.env.EMAIL_FROM_ADDRESS;
  if (!fromAddress) {
    throw new Error("AWS_SES_FROM_EMAIL is not configured");
  }
  const replyTo = getReplyTo();

  const command = new SendEmailCommand({
    FromEmailAddress: fromAddress,
    Destination: { ToAddresses: [to] },
    ReplyToAddresses: replyTo ? [replyTo] : undefined,
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          ...(html ? { Html: { Data: html, Charset: "UTF-8" } } : {}),
          ...(text ? { Text: { Data: text, Charset: "UTF-8" } } : {}),
        },
      },
    },
  });

  const response = await client.send(command);
  return {
    provider: "ses",
    messageId: response?.MessageId || null,
  };
};

const sendViaGmail = async ({ to, subject, html, text }) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP_USER / SMTP_PASS are not configured for Gmail fallback");
  }
  const transporter = getGmailTransporter();
  const info = await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject,
    html: html || undefined,
    text: text || undefined,
    replyTo: getReplyTo(),
  });
  return {
    provider: "gmail",
    messageId: info?.messageId || null,
  };
};

const sendViaConsole = async ({ to, subject }) => {
  // Last-resort fallback (tests, or no credentials configured)
  // eslint-disable-next-line no-console
  console.log(
    `[email:console] would send to=${to} subject="${subject}" provider=${getActiveProvider()}`
  );
  return { provider: "console", messageId: null };
};

const dispatch = async (payload) => {
  const provider = getActiveProvider();
  if (provider === "ses") return sendViaSes(payload);
  if (provider === "gmail") return sendViaGmail(payload);
  return sendViaConsole(payload);
};

export const getActiveProvider = () => resolveProvider();

// ---------- Public API ----------

export const queueEmail = async ({
  to,
  subject,
  html,
  text,
  category = "transactional",
}) => {
  const provider = getActiveProvider();
  const emailJob = {
    id: `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    to,
    subject,
    html,
    text,
    category,
    status: "queued",
    provider,
    attempts: 0,
  };

  await EmailJobModel.create(emailJob);

  // eslint-disable-next-line no-console
  console.log(
    `[email] queued for ${to}: "${subject}" (provider=${provider})`
  );
  return emailJob;
};

export const sendEmailNow = async ({ to, subject, html, text, category }) => {
  return dispatch({ to, subject, html, text, category });
};

export const sendQueuedEmail = async (job) => {
  if (!job || job.status === "sent") return job;
  try {
    const result = await dispatch({
      to: job.to,
      subject: job.subject,
      html: job.html,
      text: job.text,
    });
    job.status = "sent";
    job.provider = result.provider;
    job.messageId = result.messageId;
    job.sentAt = new Date();
    job.lastError = null;
    await job.save();
    return job;
  } catch (error) {
    job.status = "failed";
    job.attempts = (job.attempts || 0) + 1;
    job.lastError = error?.message || String(error);
    job.provider = getActiveProvider();
    await job.save();
    // eslint-disable-next-line no-console
    console.error(
      `[email] failed to send ${job.id} to=${job.to}: ${job.lastError}`
    );
    throw error;
  }
};
