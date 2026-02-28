// ============================================================
//  controllers/userController.js  — User management & stats
// ============================================================
const { query } = require("../config/db");

/* ──────────────────────────────────────────────
   GET /api/users
   ?role=artist|user|helper  ?city=Pune  ?page=1&limit=20
────────────────────────────────────────────── */
const getUsers = async (req, res, next) => {
  try {
    const { role, city, page = 1, limit = 20 } = req.query;
    const conditions = ["u.is_active = TRUE"];
    const params     = [];
    let   idx        = 1;

    if (role) { conditions.push(`u.role = $${idx++}`); params.push(role); }
    if (city) { conditions.push(`u.city ILIKE $${idx++}`); params.push(`%${city}%`); }

    const WHERE = `WHERE ${conditions.join(" AND ")}`;

    const countRes = await query(
      `SELECT COUNT(*) FROM users u ${WHERE}`, params
    );
    const total  = parseInt(countRes.rows[0].count);
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { rows } = await query(
      `SELECT u.id, u.name, u.email, u.phone, u.role,
              u.green_coins, u.avatar_url, u.city, u.state,
              u.is_verified, u.created_at,
              ap.speciality, ap.rating, ap.artworks_sold, ap.total_earnings,
              hp.vehicle_type, hp.is_available, hp.total_deliveries
       FROM   users u
       LEFT JOIN artist_profiles ap ON ap.user_id = u.id
       LEFT JOIN helper_profiles hp ON hp.user_id = u.id
       ${WHERE}
       ORDER BY u.created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      [...params, parseInt(limit), offset]
    );

    res.status(200).json({
      success: true, total, page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      count: rows.length, users: rows,
    });
  } catch (err) {
    next(err);
  }
};

/* ──────────────────────────────────────────────
   GET /api/users/:id   (public)
────────────────────────────────────────────── */
const getUserById = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.name, u.email, u.phone, u.role,
              u.green_coins, u.avatar_url, u.city, u.state, u.street,
              u.is_verified, u.created_at,
              ap.bio, ap.speciality, ap.portfolio_url,
              ap.rating, ap.rating_count, ap.artworks_sold, ap.total_earnings,
              hp.vehicle_type, hp.is_available, hp.total_deliveries, hp.total_waste_kg
       FROM   users u
       LEFT JOIN artist_profiles ap ON ap.user_id = u.id
       LEFT JOIN helper_profiles hp ON hp.user_id = u.id
       WHERE  u.id = $1 AND u.is_active = TRUE`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    res.status(200).json({ success: true, user: rows[0] });
  } catch (err) {
    next(err);
  }
};

/* ──────────────────────────────────────────────
   GET /api/users/:id/stats   (protected)
   Aggregated KPI stats for a user's dashboard
────────────────────────────────────────────── */
const getUserStats = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);

    /* Core user data */
    const { rows: userRows } = await query(
      "SELECT id, role, green_coins FROM users WHERE id = $1 AND is_active = TRUE",
      [userId]
    );
    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    const user = userRows[0];

    /* Item stats */
    const { rows: itemStats } = await query(
      `SELECT
         COUNT(*)                              AS total_listings,
         COUNT(*) FILTER (WHERE status='sold')     AS sold,
         COUNT(*) FILTER (WHERE status='donated')  AS donated,
         COUNT(*) FILTER (WHERE status='active')   AS active
       FROM items WHERE uploaded_by = $1`,
      [userId]
    );

    /* Transaction aggregates */
    const { rows: txnStats } = await query(
      `SELECT
         COALESCE(SUM(green_coins), 0)                        AS total_coins_earned,
         COALESCE(SUM(amount_inr) FILTER (WHERE type = 'item_purchase'), 0) AS total_inr_earned
       FROM transactions WHERE to_user_id = $1 AND status = 'completed'`,
      [userId]
    );

    /* Role-specific stats */
    let roleStats = null;

    if (user.role === "artist") {
      const { rows } = await query(
        "SELECT total_earnings, artworks_sold, rating, rating_count FROM artist_profiles WHERE user_id = $1",
        [userId]
      );
      roleStats = rows[0] || {};
    }

    if (user.role === "helper") {
      const [{ rows: hp }, { rows: tasks }] = await Promise.all([
        query("SELECT total_waste_kg, total_deliveries FROM helper_profiles WHERE user_id = $1", [userId]),
        query(
          `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='delivered') AS delivered
           FROM tasks WHERE assigned_helper = $1`,
          [userId]
        ),
      ]);
      roleStats = { ...(hp[0] || {}), ...(tasks[0] || {}) };
    }

    res.status(200).json({
      success: true,
      stats: {
        green_coins:      user.green_coins,
        ...itemStats[0],
        ...txnStats[0],
        ...(roleStats ? { role_stats: roleStats } : {}),
      },
    });
  } catch (err) {
    next(err);
  }
};

/* ──────────────────────────────────────────────
   GET /api/users/me/transactions   (protected)
   Full ledger for the logged-in user
────────────────────────────────────────────── */
const getMyTransactions = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT t.*,
              f.name AS from_name, f.role AS from_role,
              r.name AS to_name,   r.role AS to_role,
              i.title AS item_title, i.category AS item_category
       FROM   transactions t
       LEFT JOIN users f ON f.id = t.from_user_id
       LEFT JOIN users r ON r.id = t.to_user_id
       LEFT JOIN items i ON i.id = t.item_id
       WHERE  t.from_user_id = $1 OR t.to_user_id = $1
       ORDER BY t.created_at DESC`,
      [req.user.id]
    );
    res.status(200).json({ success: true, count: rows.length, transactions: rows });
  } catch (err) {
    next(err);
  }
};

module.exports = { getUsers, getUserById, getUserStats, getMyTransactions };
