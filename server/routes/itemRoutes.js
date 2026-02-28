// ============================================================
//  routes/itemRoutes.js  — /api/items/*
// ============================================================
const router   = require("express").Router();
const { body } = require("express-validator");

const {
  getItems, getMyItems, getItemById, createItem,
  updateItem, deleteItem, buyItem, donateItem,
} = require("../controllers/itemController");

const { protect, authorize } = require("../middleware/auth");
const upload                 = require("../middleware/upload");
const validate               = require("../middleware/validate");

const createRules = [
  body("title").trim().notEmpty().withMessage("Title required")
    .isLength({ min:3, max:120 }).withMessage("Title 3–120 chars"),
  body("category")
    .isIn(["metal","plastic","e-waste","wood","glass","paper",
           "textile","rubber","ceramic","composite","artwork","other"])
    .withMessage("Invalid category"),
  body("listing_type")
    .isIn(["sell","donate","scrap"]).withMessage("listing_type: sell | donate | scrap"),
  body("price").optional().isNumeric().withMessage("Price must be numeric"),
  body("weight_kg").optional().isNumeric().withMessage("Weight must be numeric"),
];

// GET  /api/items           — Public
router.get("/",    getItems);
// GET  /api/items/my        — Private
router.get("/my",  protect, getMyItems);
// GET  /api/items/:id       — Public
router.get("/:id", getItemById);
// POST /api/items           — Private (user, artist) + file upload
router.post("/", protect, authorize("user","artist"), upload.array("images", 6), createRules, validate, createItem);
// PUT  /api/items/:id       — Private (owner)
router.put("/:id",  protect, authorize("user","artist"), updateItem);
// DELETE /api/items/:id     — Private (owner, soft-delete)
router.delete("/:id", protect, authorize("user","artist"), deleteItem);
// POST /api/items/:id/buy   — Private (user, artist)
router.post("/:id/buy",   protect, authorize("user","artist"), buyItem);
// POST /api/items/:id/donate — Private (user/owner)
router.post("/:id/donate", protect, authorize("user"), donateItem);

module.exports = router;
