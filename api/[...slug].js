// ============================================================
//  api/[...slug].js — Catch‑all Vercel serverless entrypoint
//
//  Ensures *all* /api/* routes are handled by the existing
//  Express app defined in server/index.js (auth, items, tasks,
//  users, etc.).
// ============================================================

const app = require("../server/index.js");

// Express apps are compatible request handlers for Vercel's Node
// runtime, so we can export the app function directly.
module.exports = app;

