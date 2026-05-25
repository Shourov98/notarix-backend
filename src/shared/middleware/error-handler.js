import { fail } from "../http/respond.js";

export class AppError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFoundHandler = (req, _res, next) => {
  next(
    new AppError(
      404,
      "NOT_FOUND",
      `No route matched ${req.method} ${req.originalUrl}`
    )
  );
};

export const errorHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    return fail(res, error.status, error.code, error.message, error.details);
  }

  console.error(error);
  return fail(
    res,
    500,
    "INTERNAL_ERROR",
    "Unexpected error occurred. Please contact support with requestId."
  );
};
