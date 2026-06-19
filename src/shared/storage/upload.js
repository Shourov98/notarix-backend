import multer from "multer";
import { config } from "../../config.js";
import { AppError } from "../middleware/error-handler.js";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxFileSizeMb * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(pdf|png|jpe?g|docx?)$/i.test(file.originalname);

    if (!allowed) {
      return cb(
        new AppError(
          400,
          "INVALID_FILE_TYPE",
          "Only PDF, PNG, JPG, JPEG, DOC, and DOCX files are allowed."
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
