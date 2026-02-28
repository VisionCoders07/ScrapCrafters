// ============================================================
//  routes/userRoutes.js  — /api/users/*
// ============================================================
const router = require("express").Router();
const {
  getUsers, getUserById, getUserStats, getMyTransactions,
} = require("../controllers/userController");
const { protect } = require("../middleware/auth");

// GET /api/users                    — Public
router.get("/",                  getUsers);
// GET /api/users/me/transactions    — Private
router.get("/me/transactions",   protect, getMyTransactions);
// GET /api/users/:id                — Public
router.get("/:id",               getUserById);
// GET /api/users/:id/stats          — Private
router.get("/:id/stats",         protect, getUserStats);

module.exports = router;
