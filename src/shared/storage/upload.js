import multer from "multer";
import { config } from "../../config.js";
import { AppError } from "../middleware/error-handler.js";

// Extension allowlist covers documents and images that notaries/clients
// realistically upload. Note: the filter is extension-based; if you need
// stricter validation, also check `file.mimetype` below.
const ALLOWED_EXTENSION_REGEX = /\.(pdf|docx?|odt|ods|odp|rtf|txt|md|csv|xlsx?|pptx?|png|jpe?g|gif|webp|bmp|tiff?|heic|heif|svg|ico|avif)$/i;

const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf", "text/"];

const ALLOWED_MIME_EXACT = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "application/rtf",
  "application/heic",
  "application/heif",
]);

const isAllowed = (file) => {
  if (ALLOWED_EXTENSION_REGEX.test(file.originalname || "")) {
    return true;
  }

  const mime = String(file.mimetype || "").toLowerCase();
  if (!mime) {
    return false;
  }

  if (ALLOWED_MIME_EXACT.has(mime)) {
    return true;
  }

  return ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
};

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxFileSizeMb * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!isAllowed(file)) {
      return cb(
        new AppError(
          400,
          "INVALID_FILE_TYPE",
          "Only document (PDF, DOC, DOCX, ODT, ODS, ODP, RTF, TXT, CSV, XLSX, PPTX) and image (PNG, JPG, JPEG, GIF, WEBP, BMP, TIFF, HEIC, SVG, AVIF) files are allowed."
        )
      );
    }

    cb(null, true);
  },
});

export const handleUploadErrors = (error, _req, _res, next) => {
  if (error instanceof multer.MulterError) {
    return next(
      new AppError(400, "UPLOAD_ERROR", error.message)
    );
  }

  return next(error);
};
