// ============================================================
//  config/jwt.js  — JWT sign / verify helpers
// ============================================================
const jwt = require("jsonwebtoken");

const SECRET  = process.env.JWT_SECRET     || "fallback_dev_secret_change_me";
const EXPIRES = process.env.JWT_EXPIRES_IN || "7d";

/**
 * Sign a JWT with the given user payload.
 * @param   {{ id: number, role: string }} payload
 * @returns {string} signed token
 */
const signToken = (payload) =>
  jwt.sign(payload, SECRET, { expiresIn: EXPIRES });

/**
 * Verify and decode a JWT.
 * @param   {string} token
 * @returns {object} decoded payload
 * @throws  {JsonWebTokenError | TokenExpiredError}
 */
const verifyToken = (token) => jwt.verify(token, SECRET);

module.exports = { signToken, verifyToken };
