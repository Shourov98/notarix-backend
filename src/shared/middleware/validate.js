import { ZodError } from "zod";
import { AppError } from "./error-handler.js";

// Format a single Zod issue into a dotted JSON-pointer-style path so the
// frontend can show the user exactly which field is wrong (e.g. "body ->
// personalInfo.email -> Invalid email"). Falls back to the root segment if the
// path is empty.
const formatIssuePath = (path) => {
  if (!Array.isArray(path) || path.length === 0) return "(root)";
  return path
    .map((segment) => {
      if (typeof segment === "number") return `[${segment}]`;
      if (/^[a-zA-Z_$][\w$]*$/.test(segment)) return segment;
      return `"${segment}"`;
    })
    .join(".");
};

const formatZodIssues = (issues = []) =>
  issues.map((issue) => `${formatIssuePath(issue.path)} -> ${issue.message}`);

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
      const issues = formatZodIssues(error.issues);
      const summary = issues.length > 0
        ? `Request validation failed: ${issues.join("; ")}`
        : "Request validation failed.";
      return next(
        new AppError(400, "INVALID_INPUT", summary, {
          issues,
          zodIssues: error.issues,
        })
      );
    }

    return next(error);
  }
};
