import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config } from "../../config.js";

const isCloudinaryEnabled = () =>
  config.storageProvider === "cloudinary" &&
  config.cloudinaryCloudName &&
  config.cloudinaryApiKey &&
  config.cloudinaryApiSecret;

const toUploadUrl = () =>
  `https://api.cloudinary.com/v1_1/${config.cloudinaryCloudName}/auto/upload`;

const signUploadParams = (params) => {
  const serialized = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(`${serialized}${config.cloudinaryApiSecret}`)
    .digest("hex");
};

const buildPublicId = (file) => {
  const safeName = String(file.originalname || "file")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9/_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  return `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName || "file"}`;
};

export const uploadToCloudinary = async (file, { folder } = {}) => {
  if (!file?.buffer) {
    throw new Error("Upload buffer is missing.");
  }

  if (!isCloudinaryEnabled()) {
    throw new Error("Cloudinary storage is not configured.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = buildPublicId(file);
  const params = {
    folder,
    public_id: publicId,
    timestamp,
  };
  const signature = signUploadParams(params);

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([file.buffer], { type: file.mimetype || "application/octet-stream" }),
    file.originalname || "upload"
  );
  formData.append("api_key", config.cloudinaryApiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  if (folder) {
    formData.append("folder", folder);
  }
  formData.append("public_id", publicId);

  const response = await fetch(toUploadUrl(), {
    method: "POST",
    body: formData,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Cloudinary upload failed.");
  }

  return {
    provider: "cloudinary",
    file: payload.public_id,
    url: payload.secure_url,
    mimeType: file.mimetype || payload.resource_type || null,
    size: file.size || payload.bytes || null,
  };
};

export const storeUploadedFile = async (file, options = {}) => {
  if (config.storageProvider === "cloudinary") {
    return uploadToCloudinary(file, options);
  }

  const safeName = String(file.originalname || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
  const generatedName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;
  const absolutePath = path.resolve(process.cwd(), config.uploadTmpDir, generatedName);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, file.buffer);

  return {
    provider: "local",
    file: generatedName,
    url: null,
    mimeType: file.mimetype || null,
    size: file.size || null,
  };
};

// Kept for backwards compatibility with existing call sites; new uploads produce
// clean URLs so no runtime normalization is needed. Historical uploads may have
// been stored at "doubled" paths (e.g. folder/a/folder/a/file) but those URLs
// must be preserved as-is because the asset genuinely lives at that path in
// Cloudinary for legacy records.
export const normalizeCloudinaryUrl = (url) => url;
