// ============================================================
//  middleware/errorHandler.js  — Global error handler
//  Handles PostgreSQL (pg) error codes as well as general errors
// ============================================================

const notFound = (req, res, next) => {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.statusCode = 404;
  next(err);
};

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message    = err.message || "Internal Server Error";
  let errors     = null;

  /* ── PostgreSQL error codes ── */

  // Unique violation (e.g., duplicate email)
  if (err.code === "23505") {
    statusCode = 409;
    const col  = (err.detail || "").match(/Key \((.+?)\)/)?.[1] || "field";
    message = `A record with this ${col} already exists.`;
  }

  // Foreign key violation
  if (err.code === "23503") {
    statusCode = 400;
    message = "Referenced record does not exist.";
  }

  // Not-null violation
  if (err.code === "23502") {
    statusCode = 422;
    const col  = err.column || "field";
    message = `The field "${col}" is required.`;
  }

  // Invalid enum value
  if (err.code === "22P02" || err.code === "23514") {
    statusCode = 400;
    message = "Invalid value for one of the fields.";
  }

  // Invalid UUID / type cast
  if (err.code === "22P02") {
    statusCode = 400;
    message = "Invalid ID or field format.";
  }

  /* ── JWT errors ── */
  if (err.name === "JsonWebTokenError") { statusCode = 401; message = "Invalid token."; }
  if (err.name === "TokenExpiredError") { statusCode = 401; message = "Token expired."; }

  /* ── express-validator errors (passed as array) ── */
  if (Array.isArray(err.errors)) {
    statusCode = 422;
    message    = "Validation failed";
    errors     = err.errors;
  }

  const payload = { success: false, statusCode, message };
  if (errors) payload.errors = errors;
  if (process.env.NODE_ENV === "development") payload.stack = err.stack;

  res.status(statusCode).json(payload);
};

module.exports = { notFound, errorHandler };
