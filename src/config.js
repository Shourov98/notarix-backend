import path from "node:path";

const resolveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveList = (value, fallback) =>
  String(value || fallback)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const ensureSafeProductionSecrets = () => {
  if ((process.env.NODE_ENV || "development") !== "production") {
    return;
  }

  const missing = [];
  if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.includes("replace_with")) {
    missing.push("JWT_ACCESS_SECRET");
  }
  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.includes("replace_with")) {
    missing.push("JWT_REFRESH_SECRET");
  }
  if (
    !process.env.BANK_INFO_ENCRYPTION_KEY ||
    process.env.BANK_INFO_ENCRYPTION_KEY.includes("replace_with")
  ) {
    missing.push("BANK_INFO_ENCRYPTION_KEY");
  }

  if (missing.length > 0) {
    throw new Error(
      `Unsafe production configuration. Set real values for: ${missing.join(", ")}`
    );
  }
};

ensureSafeProductionSecrets();

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: resolveNumber(process.env.PORT, 5191),
  apiPrefix: process.env.API_PREFIX || "/api/v1",
  appUrl: process.env.APP_URL || "http://localhost:5191",
  clientAppUrl: process.env.CLIENT_APP_URL || "http://localhost:3000",
  adminAppUrl: process.env.ADMIN_APP_URL || "http://localhost:5173",
  tokenSecret: process.env.JWT_ACCESS_SECRET || "notarix-dev-access-secret",
  refreshSecret: process.env.JWT_REFRESH_SECRET || "notarix-dev-refresh-secret",
  bankInfoEncryptionKey:
    process.env.BANK_INFO_ENCRYPTION_KEY || "notarix-dev-bank-info-secret",
  mongodbUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/notarix",
  mongodbDbName: process.env.MONGODB_DB_NAME || "notarix",
  mongodbOptional: process.env.MONGODB_OPTIONAL !== "false",
  maxFileSizeMb: resolveNumber(process.env.MAX_FILE_SIZE_MB, 25),
  authRateLimitWindowMs: resolveNumber(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  authRateLimitMax: resolveNumber(process.env.AUTH_RATE_LIMIT_MAX, 25),
  apiRateLimitWindowMs: resolveNumber(process.env.API_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  apiRateLimitMax: resolveNumber(process.env.API_RATE_LIMIT_MAX, 300),
  uploadTmpDir: process.env.UPLOAD_TMP_DIR || "tmp/uploads",
  requestIdHeader: process.env.REQUEST_ID_HEADER || "x-request-id",
  corsOrigins: resolveList(
    process.env.CORS_ORIGIN,
    `${process.env.CLIENT_APP_URL || "http://localhost:3000"},${process.env.ADMIN_APP_URL || "http://localhost:5173"}`
  ),
  socketCorsOrigin: resolveList(
    process.env.SOCKET_CORS_ORIGIN,
    "http://localhost:3000,http://localhost:5173"
  ),
  dataFilePath: path.resolve(process.cwd(), "data", "store.json"),
};
