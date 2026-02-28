// ============================================================
//  server/index.js  — SCRAP-CRAFTERS Express + PostgreSQL Server
//
//  Start:    npm run dev          (nodemon)
//  Setup DB: npm run db:init      (creates tables)
//  Seed:     npm run db:seed      (loads sample data)
//  Reset:    npm run db:reset     (drop + recreate + seed)
//
//  API Base: http://localhost:5000/api
// ============================================================
require("dotenv").config();

const express  = require("express");
const cors     = require("cors");
const helmet   = require("helmet");
const morgan   = require("morgan");
const path     = require("path");

const { connectDB }              = require("./config/db");
const authRoutes                 = require("./routes/authRoutes");
const itemRoutes                 = require("./routes/itemRoutes");
const taskRoutes                 = require("./routes/taskRoutes");
const userRoutes                 = require("./routes/userRoutes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app  = express();
const PORT = process.env.PORT || 5000;

/* ── Verify PostgreSQL connection on startup ── */
connectDB();

/* ─────────────────────── GLOBAL MIDDLEWARE ─────────────────────── */

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

app.use(cors({
  origin:      process.env.CLIENT_ORIGIN || "http://localhost:3000",
  credentials: true,
  methods:     ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

/* ── Serve uploaded images ── */
app.use(
  "/uploads",
  express.static(path.join(__dirname, process.env.UPLOAD_DIR || "uploads"))
);

/* ─────────────────────── HEALTH CHECK ─────────────────────── */

// @route GET /health  — liveness probe
app.get("/health", (_req, res) =>
  res.json({ status: "ok", service: "SCRAP-CRAFTERS API", db: "PostgreSQL", time: new Date().toISOString() })
);

/* ─────────────────────── API ROUTES ─────────────────────── */

app.use("/api/auth",  authRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/users", userRoutes);

/* ─────────────────────── ERROR HANDLING ─────────────────────── */

app.use(notFound);
app.use(errorHandler);

/* ─────────────────────── START ─────────────────────── */

app.listen(PORT, () => {
  console.log("╔═════════════════════════════════════════════════╗");
  console.log("║   🌿  SCRAP-CRAFTERS API  (PostgreSQL Edition)  ║");
  console.log(`║   🚀  http://localhost:${PORT}                      ║`);
  console.log(`║   🐘  DB: ${(process.env.PGDATABASE || "scrapcrafters").padEnd(37)}║`);
  console.log(`║   🌍  ${(process.env.NODE_ENV || "development").padEnd(42)}║`);
  console.log("╠═════════════════════════════════════════════════╣");
  console.log("║  Setup:  npm run db:init  →  npm run db:seed    ║");
  console.log("║  Reset:  npm run db:reset                       ║");
  console.log("╚═════════════════════════════════════════════════╝");
});

process.on("SIGTERM", () => { console.log("\n⏹️  Shutting down…"); process.exit(0); });

module.exports = app;
