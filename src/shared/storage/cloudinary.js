import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config } from "../../config.js";

const isCloudinaryEnabled = () =>
  config.storageProvider === "cloudinary" &&
  config.cloudinaryCloudName &&
  config.cloudinaryApiKey &&
  config.cloudinaryApiSecret;

const RAW_MIME_PREFIXES = ["application/pdf", "application/zip", "application/x-zip"];
const RAW_MIME_EXACT = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-7z-compressed",
  "application/x-rar-compressed",
  "application/x-tar",
  "application/gzip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
]);

const isRawMime = (mimeType) => {
  if (!mimeType) return false;
  if (RAW_MIME_EXACT.has(mimeType)) return true;
  return RAW_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
};

const detectResourceType = (file) => {
  const mime = file?.mimetype || "";
  if (mime.startsWith("video/")) return "video";
  if (isRawMime(mime)) return "raw";
  return "image";
};

const toUploadUrl = (resourceType = "auto") =>
  `https://api.cloudinary.com/v1_1/${config.cloudinaryCloudName}/${resourceType}/upload`;

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

export const uploadToCloudinary = async (file, { folder, resourceType } = {}) => {
  if (!file?.buffer) {
    throw new Error("Upload buffer is missing.");
  }

  if (!isCloudinaryEnabled()) {
    throw new Error("Cloudinary storage is not configured.");
  }

  const resolvedResourceType = resourceType || detectResourceType(file);
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = buildPublicId(file);
  // `type: "upload"` forces Cloudinary to mark the asset as publicly deliverable
  // via the unsigned secure_url. Without it Cloudinary may default to a private
  // delivery type, in which case every fetch returns HTTP 401.
  const params = {
    folder,
    public_id: publicId,
    timestamp,
    type: "upload",
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
  formData.append("type", "upload");
  if (folder) {
    formData.append("folder", folder);
  }
  formData.append("public_id", publicId);

  const response = await fetch(toUploadUrl(resolvedResourceType), {
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
    resourceType: payload.resource_type || resolvedResourceType,
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

// Transforms a stored Cloudinary URL so non-image files (PDFs, docs, archives)
// are served via the `raw/upload` delivery URL. Legacy uploads used
// `/image/upload/` for everything; Cloudinary then transcodes the response,
// which breaks PDF viewing in the browser.
//
// Also strips a known "doubled-folder" bug from older rows where the public_id
// contained the folder prefix twice in a row.
export const normalizeCloudinaryUrl = (url, mimeType) => {
  if (typeof url !== "string" || !url.startsWith("http")) {
    return url;
  }

  try {
    const parsed = new URL(url);

    // Flip resource type from "image" to "raw" for non-image MIME types so the
    // browser receives the original bytes instead of an image transcoding.
    if (typeof mimeType === "string" && isRawMime(mimeType) && !parsed.pathname.includes("/raw/upload/")) {
      parsed.pathname = parsed.pathname.replace(/\/image\/upload\//, "/raw/upload/");
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    const uploadIndex = segments.findIndex((segment) => segment === "upload");
    if (uploadIndex === -1) {
      return parsed.toString();
    }

    const publicIdSegments = segments.slice(uploadIndex + 2);
    if (publicIdSegments.length < 2) {
      return parsed.toString();
    }

    // Detect and collapse a doubled-folder prefix in the public_id
    // (e.g. folder/a/folder/a/<file> -> folder/a/<file>).
    for (
      let prefixLength = 1;
      prefixLength <= Math.floor(publicIdSegments.length / 2);
      prefixLength += 1
    ) {
      const prefix = publicIdSegments.slice(0, prefixLength).join("/");
      const second = publicIdSegments.slice(prefixLength, prefixLength * 2);
      if (second.length === prefixLength && second.join("/") === prefix) {
        const collapsed = [
          ...publicIdSegments.slice(0, prefixLength),
          ...publicIdSegments.slice(prefixLength * 2),
        ];
        const nextSegments = [
          ...segments.slice(0, uploadIndex + 2),
          ...collapsed,
        ];
        parsed.pathname = `/${nextSegments.join("/")}`;
        return parsed.toString();
      }
    }

    return parsed.toString();
  } catch (error) {
    return url;
  }
};
