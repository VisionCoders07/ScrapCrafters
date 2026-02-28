// ============================================================
//  controllers/itemController.js  — Items CRUD + buy/donate
// ============================================================
const { query, withTransaction } = require("../config/db");

/* ── Helper: attach images + tags to an item row ── */
const enrichItem = async (item) => {
  if (!item) return null;
  const [imgRes, tagRes] = await Promise.all([
    query(
      "SELECT url, filename, mimetype, size_bytes, sort_order FROM item_images WHERE item_id = $1 ORDER BY sort_order",
      [item.id]
    ),
    query("SELECT tag FROM item_tags WHERE item_id = $1 ORDER BY tag", [item.id]),
  ]);
  item.images = imgRes.rows;
  item.tags   = tagRes.rows.map((r) => r.tag);
  return item;
};

/* ── Shared SELECT fragment with seller + buyer join ── */
const ITEM_SELECT = `
  SELECT i.*,
         u.name  AS seller_name,
         u.city  AS seller_city,
         u.role  AS seller_role,
         u.avatar_url AS seller_avatar,
         b.name  AS buyer_name
  FROM   items i
  LEFT JOIN users u ON u.id = i.uploaded_by
  LEFT JOIN users b ON b.id = i.bought_by
`;

/* ──────────────────────────────────────────────
   GET /api/items
   Query params: category, listing_type, status,
                 city, search, page, limit, sort
────────────────────────────────────────────── */
const getItems = async (req, res, next) => {
  try {
    const {
      category, listing_type, status = "active",
      city, search,
      page = 1, limit = 12,
      sort = "newest",
    } = req.query;

    /* Build WHERE clauses dynamically */
    const conditions = ["i.status = $1"];
    const params     = [status];
    let   idx        = 2;

    if (category)     { conditions.push(`i.category = $${idx++}`);           params.push(category); }
    if (listing_type) { conditions.push(`i.listing_type = $${idx++}`);       params.push(listing_type); }
    if (city)         { conditions.push(`i.item_city ILIKE $${idx++}`);      params.push(`%${city}%`); }
    if (search)       { conditions.push(`i.search_vector @@ plainto_tsquery('english', $${idx++})`); params.push(search); }

    const WHERE = `WHERE ${conditions.join(" AND ")}`;

    /* Sort */
    const ORDER = {
      newest:     "i.created_at DESC",
      oldest:     "i.created_at ASC",
      price_asc:  "i.price ASC",
      price_desc: "i.price DESC",
    }[sort] || "i.created_at DESC";

    /* Count total */
    const countRes = await query(
      `SELECT COUNT(*) FROM items i ${WHERE}`,
      params
    );
    const total = parseInt(countRes.rows[0].count);

    /* Paginated data */
    const offset    = (parseInt(page) - 1) * parseInt(limit);
    const dataParams = [...params, parseInt(limit), offset];
    const { rows }  = await query(
      `${ITEM_SELECT} ${WHERE}
       ORDER BY ${ORDER}
       LIMIT $${idx++} OFFSET $${idx}`,
      dataParams
    );

    /* Enrich with images + tags */
    const items = await Promise.all(rows.map(enrichItem));

    res.status(200).json({
      success: true,
      total,
      page:   parseInt(page),
      pages:  Math.ceil(total / parseInt(limit)),
      count:  items.length,
      items,
    });
  } catch (err) {
    next(err);
  }
};

/* ──────────────────────────────────────────────
   GET /api/items/my   (protected)
────────────────────────────────────────────── */
const getMyItems = async (req, res, next) => {
  try {
    const { rows } = await query(
      `${ITEM_SELECT}
       WHERE i.uploaded_by = $1
       ORDER BY i.created_at DESC`,
      [req.user.id]
    );
    const items = await Promise.all(rows.map(enrichItem));
    res.status(200).json({ success: true, count: items.length, items });
  } catch (err) {
    next(err);
  }
};

/* ──────────────────────────────────────────────
   GET /api/items/:id   (public, increments views)
────────────────────────────────────────────── */
const getItemById = async (req, res, next) => {
  try {
    await query("UPDATE items SET views = views + 1 WHERE id = $1", [req.params.id]);
    const { rows } = await query(
      `${ITEM_SELECT} WHERE i.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Item not found." });
    }
    const item = await enrichItem(rows[0]);
    res.status(200).json({ success: true, item });
  } catch (err) {
    next(err);
  }
};

/* ──────────────────────────────────────────────
   POST /api/items   (protected — user, artist)
   Body (multipart/form-data): item fields + images
────────────────────────────────────────────── */
const createItem = async (req, res, next) => {
  try {
    const {
      title, description, category, listing_type,
      price = 0, weight_kg, condition = "fair",
      item_city, item_state, item_pincode,
      item_lat, item_lng,
      green_coins_reward = 0,
      is_negotiable = true,
      tags,
    } = req.body;

    let itemId;
    await withTransaction(async (client) => {
      /* Insert item row */
      const { rows } = await client.query(
        `INSERT INTO items
           (title, description, category, listing_type,
            price, weight_kg, condition,
            item_city, item_state, item_pincode, item_lat, item_lng,
            green_coins_reward, is_negotiable, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING id`,
        [
          title, description || "", category, listing_type,
          parseFloat(price) || 0,
          weight_kg ? parseFloat(weight_kg) : null,
          condition,
          item_city || null, item_state || null, item_pincode || null,
          item_lat  ? parseFloat(item_lat)  : null,
          item_lng  ? parseFloat(item_lng)  : null,
          parseInt(green_coins_reward) || 0,
          is_negotiable !== "false",
          req.user.id,
        ]
      );
      itemId = rows[0].id;

      /* Insert uploaded images */
      const files = req.files || [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        await client.query(
          `INSERT INTO item_images (item_id, url, filename, mimetype, size_bytes, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [itemId, `/uploads/${f.filename}`, f.filename, f.mimetype, f.size, i]
        );
      }

      /* Insert tags (comma-separated string or JSON array) */
      const tagList = tags
        ? (typeof tags === "string" ? tags.split(",").map((t) => t.trim()).filter(Boolean) : tags)
        : [];
      for (const tag of tagList) {
        await client.query(
          "INSERT INTO item_tags (item_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [itemId, tag.toLowerCase()]
        );
      }
    });

    const { rows } = await query(`${ITEM_SELECT} WHERE i.id = $1`, [itemId]);
    const item = await enrichItem(rows[0]);
    res.status(201).json({ success: true, item });
  } catch (err) {
    next(err);
  }
};

/* ──────────────────────────────────────────────
   PUT /api/items/:id   (protected — owner)
────────────────────────────────────────────── */
const updateItem = async (req, res, next) => {
  try {
    const { rows: owned } = await query(
      "SELECT id FROM items WHERE id = $1 AND uploaded_by = $2",
      [req.params.id, req.user.id]
    );
    if (owned.length === 0) {
      return res.status(403).json({ success: false, message: "Item not found or access denied." });
    }

    const {
      title, description, category, listing_type,
      price, weight_kg, condition, item_city, item_state,
      item_pincode, green_coins_reward, is_negotiable, status,
    } = req.body;

    await query(
      `UPDATE items SET
         title              = COALESCE($1,  title),
         description        = COALESCE($2,  description),
         category           = COALESCE($3,  category),
         listing_type       = COALESCE($4,  listing_type),
         price              = COALESCE($5,  price),
         weight_kg          = COALESCE($6,  weight_kg),
         condition          = COALESCE($7,  condition),
         item_city          = COALESCE($8,  item_city),
         item_state         = COALESCE($9,  item_state),
         item_pincode       = COALESCE($10, item_pincode),
         green_coins_reward = COALESCE($11, green_coins_reward),
         is_negotiable      = COALESCE($12, is_negotiable),
         status             = COALESCE($13, status)
       WHERE id = $14`,
      [
        title, description, category, listing_type,
        price ? parseFloat(price) : null,
        weight_kg ? parseFloat(weight_kg) : null,
        condition, item_city, item_state, item_pincode,
        green_coins_reward ? parseInt(green_coins_reward) : null,
        is_negotiable != null ? Boolean(is_negotiable) : null,
        status,
        req.params.id,
      ]
    );

    const { rows } = await query(`${ITEM_SELECT} WHERE i.id = $1`, [req.params.id]);
    const item = await enrichItem(rows[0]);
    res.status(200).json({ success: true, item });
  } catch (err) {
    next(err);
  }
};

/* ──────────────────────────────────────────────
   DELETE /api/items/:id   (protected — owner, soft-delete)
────────────────────────────────────────────── */
const deleteItem = async (req, res, next) => {
  try {
    const { rows } = await query(
      "UPDATE items SET status = 'archived' WHERE id = $1 AND uploaded_by = $2 RETURNING id",
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) {
      return res.status(403).json({ success: false, message: "Item not found or access denied." });
    }
    res.status(200).json({ success: true, message: "Listing archived." });
  } catch (err) {
    next(err);
  }
};

/* ──────────────────────────────────────────────
   POST /api/items/:id/buy   (protected — user, artist)
────────────────────────────────────────────── */
const buyItem = async (req, res, next) => {
  try {
    const { rows: itemRows } = await query(
      "SELECT * FROM items WHERE id = $1", [req.params.id]
    );
    if (itemRows.length === 0) {
      return res.status(404).json({ success: false, message: "Item not found." });
    }
    const item = itemRows[0];

    if (item.status !== "active") {
      return res.status(400).json({ success: false, message: "This item is no longer available." });
    }
    if (item.uploaded_by === req.user.id) {
      return res.status(400).json({ success: false, message: "You cannot buy your own listing." });
    }

    await withTransaction(async (client) => {
      /* Mark item as sold */
      await client.query(
        "UPDATE items SET status = 'sold', bought_by = $1, sold_at = NOW() WHERE id = $2",
        [req.user.id, item.id]
      );

      /* Credit seller Green Coins */
      await client.query(
        "UPDATE users SET green_coins = green_coins + $1 WHERE id = $2",
        [item.green_coins_reward, item.uploaded_by]
      );

      /* Update artist stats if seller is artist */
      await client.query(
        `UPDATE artist_profiles
         SET total_earnings = total_earnings + $1,
             artworks_sold  = artworks_sold  + 1
         WHERE user_id = $2`,
        [item.price, item.uploaded_by]
      );

      /* Log transaction */
      await client.query(
        `INSERT INTO transactions
           (from_user_id, to_user_id, type, item_id, amount_inr, green_coins, note)
         VALUES ($1, $2, 'item_purchase', $3, $4, $5, $6)`,
        [
          req.user.id, item.uploaded_by, item.id,
          item.price, item.green_coins_reward,
          `Purchase of "${item.title}"`,
        ]
      );
    });

    res.status(200).json({ success: true, message: "Item purchased successfully." });
  } catch (err) {
    next(err);
  }
};

/* ──────────────────────────────────────────────
   POST /api/items/:id/donate   (protected — user, owner)
────────────────────────────────────────────── */
const donateItem = async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT * FROM items WHERE id = $1 AND uploaded_by = $2 AND status = 'active'",
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) {
      return res.status(403).json({ success: false, message: "Item not found, not yours, or not available." });
    }
    const item        = rows[0];
    const DONATE_COINS = item.green_coins_reward || 20;

    await withTransaction(async (client) => {
      await client.query(
        "UPDATE items SET status = 'donated', listing_type = 'donate' WHERE id = $1",
        [item.id]
      );
      await client.query(
        "UPDATE users SET green_coins = green_coins + $1 WHERE id = $2",
        [DONATE_COINS, req.user.id]
      );
      await client.query(
        `INSERT INTO transactions
           (from_user_id, to_user_id, type, item_id, green_coins, note)
         VALUES (NULL, $1, 'item_donation', $2, $3, $4)`,
        [req.user.id, item.id, DONATE_COINS, `Donation of "${item.title}"`]
      );
    });

    res.status(200).json({
      success: true,
      message: `Item donated! You earned ${DONATE_COINS} Green Coins.`,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getItems, getMyItems, getItemById, createItem,
  updateItem, deleteItem, buyItem, donateItem,
};
