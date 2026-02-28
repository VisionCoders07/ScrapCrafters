// ============================================================
//  routes/taskRoutes.js  — /api/tasks/*
// ============================================================
const router   = require("express").Router();
const { body } = require("express-validator");

const {
  getTasks, getTaskById, createTask,
  assignTask, progressTask, cancelTask,
} = require("../controllers/taskController");

const { protect, authorize } = require("../middleware/auth");
const validate               = require("../middleware/validate");

const createRules = [
  body("pickup_address").notEmpty().withMessage("Pickup address required"),
  body("dropoff_address").notEmpty().withMessage("Drop-off address required"),
  body("green_coins_reward").isInt({ min:1 }).withMessage("Reward min 1 coin"),
];

// GET  /api/tasks            — Private (?type=mine|open)
router.get("/",    protect, getTasks);
// GET  /api/tasks/:id        — Private
router.get("/:id", protect, getTaskById);
// POST /api/tasks            — Private (user, artist)
router.post("/", protect, authorize("user","artist"), createRules, validate, createTask);
// PUT  /api/tasks/:id/assign   — Private (helper)
router.put("/:id/assign",   protect, authorize("helper"), assignTask);
// PUT  /api/tasks/:id/progress — Private (assigned helper)
router.put("/:id/progress", protect, authorize("helper"), progressTask);
// PUT  /api/tasks/:id/cancel   — Private (requester or helper)
router.put("/:id/cancel",   protect, cancelTask);

module.exports = router;
