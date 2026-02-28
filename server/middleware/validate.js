// ============================================================
//  middleware/validate.js  — express-validator result checker
// ============================================================
const { validationResult } = require("express-validator");

const validate = (req, res, next) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: "Validation failed",
      errors:  result.array().map((e) => ({ field: e.path || e.param, message: e.msg })),
    });
  }
  next();
};

module.exports = validate;
