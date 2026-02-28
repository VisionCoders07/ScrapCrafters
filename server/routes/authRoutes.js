// routes/authRoutes.js
const router   = require("express").Router();
const { body } = require("express-validator");
const { register, login, getMe, updateMe, changePassword } = require("../controllers/authController");
const { protect }  = require("../middleware/auth");
const validate     = require("../middleware/validate");

const registerRules = [
  body("name").trim().notEmpty().withMessage("Name is required")
    .isLength({ min:2, max:80 }).withMessage("Name must be 2–80 characters"),
  body("email").trim().isEmail().withMessage("Valid email required").normalizeEmail(),
  body("password").isLength({ min:6 }).withMessage("Password min 6 characters"),
  body("role").optional().isIn(["user","artist","helper"]).withMessage("Invalid role"),
];

const loginRules = [
  body("email").trim().isEmail().withMessage("Valid email required").normalizeEmail(),
  body("password").notEmpty().withMessage("Password required"),
];

// @route POST /api/auth/register  — Public
router.post("/register", registerRules, validate, register);
// @route POST /api/auth/login     — Public
router.post("/login",    loginRules,    validate, login);
// @route GET  /api/auth/me        — Private
router.get("/me",  protect, getMe);
// @route PUT  /api/auth/me        — Private
router.put("/me",  protect, updateMe);
// @route PUT  /api/auth/change-password — Private
router.put("/change-password", protect,
  body("currentPassword").notEmpty(), body("newPassword").isLength({ min:6 }),
  validate, changePassword
);

module.exports = router;
