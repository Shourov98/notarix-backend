import crypto from "node:crypto";

export const ok = (res, data, message = "OK", status = 200) =>
  res.status(status).json({ success: true, message, data });

export const fail = (res, status, code, message, details = undefined) =>
  res.status(status).json({
    error: {
      code,
      message,
      details,
      requestId: crypto.randomUUID(),
    },
  });
