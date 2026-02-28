// ============================================================
//  middleware/auth.js  — JWT authentication & role-based guard
// ============================================================
const { verifyToken } = require("../config/jwt");
const { query }       = require("../config/db");

/**
 * protect()
 * Reads Bearer JWT from Authorization header,
 * verifies it, loads the user row from PostgreSQL,
 * and attaches it to req.user.
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided. Please log in.",
      });
    }

    const token   = authHeader.split(" ")[1];
    const decoded = verifyToken(token);   // throws on invalid/expired

    /* Fetch user from PostgreSQL — ensures account still exists */
    const { rows } = await query(
      "SELECT id, name, email, role, green_coins, city, is_active FROM users WHERE id = $1",
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "User no longer exists." });
    }
    if (!rows[0].is_active) {
      return res.status(403).json({ success: false, message: "Account has been deactivated." });
    }

    req.user = rows[0];
    next();

  } catch (err) {
    const message =
      err.name === "TokenExpiredError"
        ? "Session expired. Please log in again."
        : "Invalid token. Please log in.";
    return res.status(401).json({ success: false, message });
  }
};

/**
 * authorize(...roles)
 * Role-based access control — must come after protect().
 *
 * Usage:
 *   router.post("/upload", protect, authorize("user", "artist"), handler)
 */
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Required: [${roles.join(", ")}]. You are: "${req.user.role}".`,
    });
  }
  next();
};

module.exports = { protect, authorize };
