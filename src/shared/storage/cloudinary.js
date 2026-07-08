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

export const normalizeCloudinaryUrl = (url) => {
  if (typeof url !== "string" || !url.startsWith("http")) {
    return url;
  }

  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);

    // Path layout: /<resource_type>/upload/v<version>/<public_id...>
    const uploadIndex = segments.findIndex((segment) => segment === "upload");
    if (uploadIndex === -1) {
      return url;
    }

    const publicIdSegments = segments.slice(uploadIndex + 2);
    if (publicIdSegments.length < 2) {
      return url;
    }

    // Detect the doubled-folder bug: the same prefix appears at the head of the
    // public_id twice in a row (e.g. notarix/orders/documents/notarix/orders/documents/<file>).
    // Find the smallest possible folder prefix where this happens and collapse to one copy.
    for (let prefixLength = 1; prefixLength <= Math.floor(publicIdSegments.length / 2); prefixLength += 1) {
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

    return url;
  } catch (error) {
    return url;
  }
};
