// ============================================================
//  controllers/authController.js  — Auth: register, login, me
// ============================================================
const bcrypt          = require("bcryptjs");
const { query, withTransaction } = require("../config/db");
const { signToken }   = require("../config/jwt");

/* ── Helper: strip password_hash before sending user to client ── */
const sanitize = (row) => {
  if (!row) return null;
  const { password_hash, ...safe } = row;
  return safe;
};

/* ── Helper: load full user with role-specific profile ── */
const fetchFullUser = async (userId) => {
  const { rows } = await query(
    `SELECT u.*,
            ap.bio, ap.speciality, ap.portfolio_url,
            ap.total_earnings, ap.artworks_sold, ap.rating, ap.rating_count,
            hp.vehicle_type, hp.total_waste_kg, hp.total_deliveries,
            hp.current_address, hp.current_lat, hp.current_lng, hp.is_available
     FROM   users u
     LEFT JOIN artist_profiles ap ON ap.user_id = u.id
     LEFT JOIN helper_profiles hp ON hp.user_id = u.id
     WHERE  u.id = $1`,
    [userId]
  );
  return rows[0] || null;
};

/* ──────────────────────────────────────────────
   POST /api/auth/register
   Body: { name, email, password, role, phone? }
────────────────────────────────────────────── */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role = "user", phone } = req.body;

    /* Check duplicate email */
    const existing = await query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase().trim()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: "An account with this email already exists." });
    }

    const passwordHash  = await bcrypt.hash(password, 12);
    const welcomeCoins  = { user: 50, artist: 80, helper: 100 }[role] || 50;

    await withTransaction(async (client) => {
      /* Insert user */
      const { rows } = await client.query(
        `INSERT INTO users (name, email, password_hash, phone, role, green_coins)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [name, email.toLowerCase().trim(), passwordHash, phone || null, role, welcomeCoins]
      );
      const userId = rows[0].id;

      /* Create role-specific profile */
      if (role === "artist") {
        await client.query(
          "INSERT INTO artist_profiles (user_id) VALUES ($1)",
          [userId]
        );
      }
      if (role === "helper") {
        await client.query(
          "INSERT INTO helper_profiles (user_id) VALUES ($1)",
          [userId]
        );
      }

      /* Log welcome coin credit */
      await client.query(
        `INSERT INTO transactions (from_user_id, to_user_id, type, green_coins, note)
         VALUES (NULL, $1, 'coin_credit', $2, 'Welcome bonus on registration')`,
        [userId, welcomeCoins]
      );
    });

    /* Fetch full user for response */
    const { rows: users } = await query(
      "SELECT * FROM users WHERE email = $1",
      [email.toLowerCase().trim()]
    );
    const user  = sanitize(users[0]);
    const token = signToken({ id: user.id, role: user.role });

    res.status(201).json({ success: true, token, user });
  } catch (err) {
    next(err);
  }
};

/* ──────────────────────────────────────────────
   POST /api/auth/login
   Body: { email, password }
────────────────────────────────────────────── */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { rows } = await query(
      "SELECT * FROM users WHERE email = $1 AND is_active = TRUE",
      [email.toLowerCase().trim()]
    );
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const userRow = rows[0];
    const match   = await bcrypt.compare(password, userRow.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const token = signToken({ id: userRow.id, role: userRow.role });
    res.status(200).json({ success: true, token, user: sanitize(userRow) });
  } catch (err) {
    next(err);
  }
};

/* ──────────────────────────────────────────────
   GET /api/auth/me   (protected)
────────────────────────────────────────────── */
const getMe = async (req, res, next) => {
  try {
    const user = await fetchFullUser(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    res.status(200).json({ success: true, user: sanitize(user) });
  } catch (err) {
    next(err);
  }
};

/* ──────────────────────────────────────────────
   PUT /api/auth/me   (protected)
   Update name, phone, avatar_url, address fields
────────────────────────────────────────────── */
const updateMe = async (req, res, next) => {
  try {
    const { name, phone, avatar_url, street, city, state, pincode } = req.body;
    const userId = req.user.id;

    await query(
      `UPDATE users
       SET name       = COALESCE($1, name),
           phone      = COALESCE($2, phone),
           avatar_url = COALESCE($3, avatar_url),
           street     = COALESCE($4, street),
           city       = COALESCE($5, city),
           state      = COALESCE($6, state),
           pincode    = COALESCE($7, pincode)
       WHERE id = $8`,
      [name, phone, avatar_url, street, city, state, pincode, userId]
    );

    /* Update role-specific profile if provided */
    const { role } = req.user;
    if (role === "artist" && req.body.artist_profile) {
      const ap = req.body.artist_profile;
      await query(
        `UPDATE artist_profiles
         SET bio           = COALESCE($1, bio),
             speciality    = COALESCE($2, speciality),
             portfolio_url = COALESCE($3, portfolio_url)
         WHERE user_id = $4`,
        [ap.bio, ap.speciality, ap.portfolio_url, userId]
      );
    }
    if (role === "helper" && req.body.helper_profile) {
      const hp = req.body.helper_profile;
      await query(
        `UPDATE helper_profiles
         SET vehicle_type    = COALESCE($1, vehicle_type),
             current_address = COALESCE($2, current_address),
             is_available    = COALESCE($3, is_available)
         WHERE user_id = $4`,
        [hp.vehicle_type, hp.current_address, hp.is_available, userId]
      );
    }

    const user = await fetchFullUser(userId);
    res.status(200).json({ success: true, user: sanitize(user) });
  } catch (err) {
    next(err);
  }
};

/* ──────────────────────────────────────────────
   PUT /api/auth/change-password   (protected)
   Body: { currentPassword, newPassword }
────────────────────────────────────────────── */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const { rows } = await query(
      "SELECT password_hash FROM users WHERE id = $1",
      [req.user.id]
    );
    const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: "Current password is incorrect." });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [newHash, req.user.id]);

    const token = signToken({ id: req.user.id, role: req.user.role });
    res.status(200).json({ success: true, token, message: "Password updated successfully." });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe, updateMe, changePassword };
