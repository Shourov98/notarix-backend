import { ZodError } from "zod";
import { AppError } from "./error-handler.js";

export const validate = (schema) => (req, _res, next) => {
  try {
    const result = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    req.body = result.body;
    req.query = result.query;
    req.params = result.params;
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      return next(
        new AppError(400, "INVALID_INPUT", "Request validation failed.", error.flatten())
      );
    }

    return next(error);
  }
};
