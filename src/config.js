import path from "node:path";

const resolveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: resolveNumber(process.env.PORT, 5191),
  apiPrefix: process.env.API_PREFIX || "/api/v1",
  appUrl: process.env.APP_URL || "http://localhost:5191",
  clientAppUrl: process.env.CLIENT_APP_URL || "http://localhost:3000",
  adminAppUrl: process.env.ADMIN_APP_URL || "http://localhost:5173",
  tokenSecret: process.env.JWT_ACCESS_SECRET || "notarix-dev-access-secret",
  refreshSecret: process.env.JWT_REFRESH_SECRET || "notarix-dev-refresh-secret",
  mongodbUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/notarix",
  mongodbDbName: process.env.MONGODB_DB_NAME || "notarix",
  mongodbOptional: process.env.MONGODB_OPTIONAL !== "false",
  maxFileSizeMb: resolveNumber(process.env.MAX_FILE_SIZE_MB, 25),
  uploadTmpDir: process.env.UPLOAD_TMP_DIR || "tmp/uploads",
  socketCorsOrigin: (process.env.SOCKET_CORS_ORIGIN || "http://localhost:3000,http://localhost:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  dataFilePath: path.resolve(process.cwd(), "data", "store.json"),
};
