import { existsSync } from "node:fs";
import { resolve } from "node:path";

const loadEnvFile = () => {
  if (typeof process.loadEnvFile !== "function") {
    return;
  }

  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  process.loadEnvFile(envPath);
};

loadEnvFile();

const resolveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveList = (value, fallback) =>
  String(value || fallback)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const isProduction = (process.env.NODE_ENV || "development") === "production";

const isPlaceholder = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return (
    !normalized ||
    normalized.includes("replace_with") ||
    normalized === "change_me" ||
    normalized === "localhost" ||
    normalized === "admin12345!"
  );
};

const requiredInProduction = (name, { allowPlaceholder = false } = {}) => {
  const value = process.env[name];
  if (!isProduction) {
    return value;
  }

  if (!value || (!allowPlaceholder && isPlaceholder(value))) {
    throw new Error(`Missing or unsafe production configuration: ${name}`);
  }

  return value;
};

const ensureSafeProductionSecrets = () => {
  if (!isProduction) {
    return;
  }

  const missing = [];
  const requiredNames = [
    "APP_URL",
    "MONGODB_URI",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "BANK_INFO_ENCRYPTION_KEY",
    "SUPER_ADMIN_EMAIL",
    "SUPER_ADMIN_PASSWORD",
    "CORS_ORIGIN",
    "SOCKET_CORS_ORIGIN",
  ];

  if ((process.env.STORAGE_PROVIDER || "local") === "cloudinary") {
    requiredNames.push(
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET"
    );
  }

  for (const name of requiredNames) {
    if (isPlaceholder(process.env[name])) {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Unsafe production configuration. Set real values for: ${missing.join(", ")}`
    );
  }
};

ensureSafeProductionSecrets();

const defaultClientUrl = isProduction ? "" : "http://localhost:3000";
const defaultAdminUrl = isProduction ? "" : "http://localhost:5173";
const defaultAppUrl = isProduction ? "" : "http://localhost:5191";
const defaultMongoUri = isProduction ? "" : "mongodb://127.0.0.1:27017/notarix";
const configuredCorsOrigin =
  process.env.CORS_ORIGIN ||
  [process.env.CLIENT_APP_URL, process.env.ADMIN_APP_URL, defaultClientUrl, defaultAdminUrl]
    .filter(Boolean)
    .join(",");
const configuredSocketCorsOrigin =
  process.env.SOCKET_CORS_ORIGIN || configuredCorsOrigin;

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: resolveNumber(process.env.PORT, 5191),
  apiPrefix: process.env.API_PREFIX || "/api/v1",
  appUrl: requiredInProduction("APP_URL", { allowPlaceholder: false }) || defaultAppUrl,
  clientAppUrl: process.env.CLIENT_APP_URL || defaultClientUrl,
  adminAppUrl: process.env.ADMIN_APP_URL || defaultAdminUrl,
  tokenSecret:
    requiredInProduction("JWT_ACCESS_SECRET", { allowPlaceholder: false }) ||
    "notarix-dev-access-secret",
  refreshSecret:
    requiredInProduction("JWT_REFRESH_SECRET", { allowPlaceholder: false }) ||
    "notarix-dev-refresh-secret",
  bankInfoEncryptionKey:
    requiredInProduction("BANK_INFO_ENCRYPTION_KEY", { allowPlaceholder: false }) ||
    "notarix-dev-bank-info-secret",
  mongodbUri: requiredInProduction("MONGODB_URI", { allowPlaceholder: false }) || defaultMongoUri,
  mongodbDbName: process.env.MONGODB_DB_NAME || "notarix",
  mongodbOptional: isProduction ? false : process.env.MONGODB_OPTIONAL !== "false",
  maxFileSizeMb: resolveNumber(process.env.MAX_FILE_SIZE_MB, 25),
  authRateLimitWindowMs: resolveNumber(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  authRateLimitMax: resolveNumber(process.env.AUTH_RATE_LIMIT_MAX, 25),
  apiRateLimitWindowMs: resolveNumber(process.env.API_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  apiRateLimitMax: resolveNumber(process.env.API_RATE_LIMIT_MAX, 300),
  uploadTmpDir: process.env.UPLOAD_TMP_DIR || "tmp/uploads",
  requestIdHeader: process.env.REQUEST_ID_HEADER || "x-request-id",
  storageProvider: process.env.STORAGE_PROVIDER || "local",
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || "",
  corsOrigins: resolveList(configuredCorsOrigin, ""),
  socketCorsOrigin: resolveList(configuredSocketCorsOrigin, ""),
};
