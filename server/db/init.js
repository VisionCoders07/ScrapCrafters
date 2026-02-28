// ============================================================
//  db/init.js  —  Create / reset database schema
//
//  Usage:
//    node db/init.js           # run schema (safe – IF NOT EXISTS)
//    node db/init.js --reset   # DROP + recreate all tables first
//
//  This script reads db/schema.sql and executes it against the
//  PostgreSQL database configured in .env.
// ============================================================
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { Pool }  = require("pg");
const fs        = require("fs");
const path      = require("path");

/* ── Connect directly (not via pool singleton, schema may not exist yet) ── */
const pool = new Pool({
  host:     process.env.PGHOST     || "localhost",
  port:     parseInt(process.env.PGPORT || "5432"),
  database: process.env.PGDATABASE || "scrapcrafters",
  user:     process.env.PGUSER     || "postgres",
  password: process.env.PGPASSWORD || "root123",
});

const run = async () => {
  const isReset = process.argv.includes("--reset");
  const client  = await pool.connect();

  try {
    if (isReset) {
      console.log("⚠️   --reset flag detected. Dropping all tables…");

      /* Drop in reverse dependency order */
      await client.query(`
        DROP TABLE IF EXISTS
          transactions, task_items, tasks,
          item_images, item_tags, items,
          helper_profiles, artist_profiles,
          users
        CASCADE;

        DROP TYPE IF EXISTS
          txn_status, txn_type, vehicle_type, task_status,
          item_status, item_condition, listing_type,
          item_category, user_role
        CASCADE;
      `);

      console.log("🗑️   All tables and types dropped.");
    }

    /* Read and execute schema */
    const schemaSQL = fs.readFileSync(
      path.join(__dirname, "schema.sql"),
      "utf8"
    );

    console.log("📄  Executing schema.sql…");
    await client.query(schemaSQL);

    console.log("\n✅  Schema applied successfully!");
    console.log("    Tables: users, artist_profiles, helper_profiles,");
    console.log("            items, item_tags, item_images,");
    console.log("            tasks, task_items, transactions");
    console.log("\n    Next step: node db/seed.js");

  } catch (err) {
    console.error("❌  Schema error:", err.message);
    if (err.detail) console.error("    Detail:", err.detail);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

run();
