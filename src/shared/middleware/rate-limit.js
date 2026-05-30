import rateLimit from "express-rate-limit";
import { config } from "../../config.js";

const buildRateLimitMessage = (message) => ({
  status: "error",
  code: "RATE_LIMITED",
  message,
});

export const apiRateLimit = rateLimit({
  windowMs: config.apiRateLimitWindowMs,
  limit: config.apiRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: buildRateLimitMessage(
    "Too many requests were sent to the API. Please slow down and try again."
  ),
});

export const authRateLimit = rateLimit({
  windowMs: config.authRateLimitWindowMs,
  limit: config.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: buildRateLimitMessage(
    "Too many authentication attempts. Please wait a few minutes and try again."
  ),
});
