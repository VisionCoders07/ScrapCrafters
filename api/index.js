// ============================================================
//  api/index.js — Vercel serverless entrypoint
//
//  This reuses the existing Express app from server/index.js and
//  exposes it as a Vercel Node.js serverless function under /api.
// ============================================================

const app = require("../server/index.js");

// Express apps are compatible request handlers for Vercel's Node
// runtime, so we can export the app function directly.
module.exports = app;

