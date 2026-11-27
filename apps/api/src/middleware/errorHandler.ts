import type { ErrorRequestHandler } from "express";
export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error?.code === 11000) {
    response.status(409).json({ error: { code: "CONFLICT", message: "A record with this value already exists" } });
    return;
  }
  if (process.env.NODE_ENV !== "production") console.error(error);
  response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected server error occurred" } });
};
