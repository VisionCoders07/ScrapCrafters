// ============================================================
//  utils/apiResponse.js  — Standard response helpers
// ============================================================
const success = (res, statusCode = 200, message = "OK", data = {}) =>
  res.status(statusCode).json({ success: true, message, ...data });

const failure = (res, statusCode = 500, message = "Server Error", errors = null) => {
  const payload = { success: false, message };
  if (errors) payload.errors = errors;
  return res.status(statusCode).json(payload);
};

module.exports = { success, failure };
