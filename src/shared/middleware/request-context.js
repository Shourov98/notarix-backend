import crypto from "node:crypto";
import { config } from "../../config.js";

export const attachRequestContext = (req, res, next) => {
  const incomingRequestId = req.headers[config.requestIdHeader];
  const requestId =
    typeof incomingRequestId === "string" && incomingRequestId.trim()
      ? incomingRequestId.trim()
      : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader(config.requestIdHeader, requestId);
  next();
};
