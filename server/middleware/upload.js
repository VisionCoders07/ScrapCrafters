// ============================================================
//  middleware/upload.js  — Multer file upload (disk storage)
// ============================================================
const multer = require("multer");
const path   = require("path");
const fs     = require("fs");

const UPLOAD_DIR = path.join(__dirname, "..", process.env.UPLOAD_DIR || "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-z0-9]/gi, "_").toLowerCase().slice(0, 40);
    cb(null, `${base}_${Date.now()}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const ok = ["image/jpeg","image/jpg","image/png","image/webp"];
  ok.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error("Only JPEG, PNG and WebP images are allowed."), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || "5242880"),
    files:    6,
  },
});

module.exports = upload;
