// ============================================================
//  config/db.js  — PostgreSQL connection pool (node-postgres)
//
//  Exports a single shared Pool instance used across the app.
//  All queries should go through pool.query() or the helper
//  functions exported by this module.
// ============================================================
const { Pool } = require("pg");

/* ── Build connection config from env ── */
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
    }
  : {
      host:     process.env.PGHOST     || "localhost",
      port:     parseInt(process.env.PGPORT || "5432"),
      database: process.env.PGDATABASE || "scrapcrafters",
      user:     process.env.PGUSER     || "postgres",
      password: process.env.PGPASSWORD || "",
      ssl:      false,
    };

/* ── Connection pool ── */
const pool = new Pool({
  ...poolConfig,
  max:              10,    // max connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

/* ── Log pool events ── */
pool.on("connect", () => {
  if (process.env.NODE_ENV !== "test") {
    console.log("🐘  PostgreSQL client connected");
  }
});

pool.on("error", (err) => {
  console.error("❌  Unexpected PostgreSQL pool error:", err.message);
});

/* ──────────────────────────────────────────────────────────
   connectDB()
   Verifies the pool can reach PostgreSQL.
   Called once on server startup.
────────────────────────────────────────────────────────── */
const connectDB = async () => {
  try {
    const client = await pool.connect();
    const { rows } = await client.query("SELECT NOW() AS now, current_database() AS db");
    console.log(`✅  PostgreSQL connected — db: "${rows[0].db}"  at ${rows[0].now}`);
    client.release();
  } catch (err) {
    console.error("❌  PostgreSQL connection failed:", err.message);
    console.error("    Check PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD in .env");
    process.exit(1);
  }
};

/* ──────────────────────────────────────────────────────────
   query(text, params)
   Thin wrapper around pool.query that logs in development.
────────────────────────────────────────────────────────── */
const query = (text, params) => {
  if (process.env.NODE_ENV === "development") {
    const start = Date.now();
    return pool.query(text, params).then((res) => {
      const ms = Date.now() - start;
      if (ms > 200) {
        console.warn(`🐢  Slow query (${ms}ms): ${text.slice(0, 80)}`);
      }
      return res;
    });
  }
  return pool.query(text, params);
};

/* ──────────────────────────────────────────────────────────
   withTransaction(callback)
   Runs multiple queries inside a single DB transaction.
   Automatically commits on success, rolls back on error.

   Usage:
     await withTransaction(async (client) => {
       await client.query("INSERT INTO users ...", [...]);
       await client.query("INSERT INTO transactions ...", [...]);
     });
────────────────────────────────────────────────────────── */
const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { pool, connectDB, query, withTransaction };
