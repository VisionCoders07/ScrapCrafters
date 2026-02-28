// ============================================================
//  controllers/taskController.js  — Pickup / delivery tasks
// ============================================================
const { query, withTransaction } = require("../config/db");

/* ── Shared SELECT with joined user names ── */
const TASK_SELECT = `
  SELECT t.*,
         r.name  AS requester_name,
         r.phone AS requester_phone,
         r.city  AS requester_city,
         h.name  AS helper_name,
         h.phone AS helper_phone
  FROM   tasks t
  LEFT JOIN users r ON r.id = t.requested_by
  LEFT JOIN users h ON h.id = t.assigned_helper
`;

/* ── Attach linked items to a task row ── */
const enrichTask = async (task) => {
  if (!task) return null;
  const { rows } = await query(
    `SELECT i.id, i.title, i.category, i.weight_kg, i.status,
            ii.url AS primary_image
     FROM   task_items ti
     JOIN   items i  ON i.id = ti.item_id
     LEFT JOIN item_images ii ON ii.item_id = i.id AND ii.sort_order = 0
     WHERE  ti.task_id = $1`,
    [task.id]
  );
  task.items = rows;
  return task;
};

/* ──────────────────────────────────────────────
   GET /api/tasks   (protected)
   ?type=mine|open|all
────────────────────────────────────────────── */
const getTasks = async (req, res, next) => {
  try {
    const { type = "mine" } = req.query;
    let rows;

    if (type === "open") {
      /* Unassigned pending tasks — any helper can see */
      ({ rows } = await query(
        `${TASK_SELECT}
         WHERE t.status = 'pending' AND t.assigned_helper IS NULL
         ORDER BY t.is_urgent DESC, t.created_at ASC`
      ));
    } else {
      /* Tasks for the logged-in helper / requester */
      ({ rows } = await query(
        `${TASK_SELECT}
         WHERE t.assigned_helper = $1 OR t.requested_by = $1
         ORDER BY t.created_at DESC`,
        [req.user.id]
      ));
    }

    const tasks = await Promise.all(rows.map(enrichTask));
    res.status(200).json({ success: true, count: tasks.length, tasks });
  } catch (err) {
    next(err);
  }
};

/* ──────────────────────────────────────────────
   GET /api/tasks/:id   (protected)
────────────────────────────────────────────── */
const getTaskById = async (req, res, next) => {
  try {
    const { rows } = await query(
      `${TASK_SELECT} WHERE t.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Task not found." });
    }
    const task = rows[0];

    /* Only requester or assigned helper can view */
    if (task.requested_by !== req.user.id && task.assigned_helper !== req.user.id) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    await enrichTask(task);
    res.status(200).json({ success: true, task });
  } catch (err) {
    next(err);
  }
};

/* ──────────────────────────────────────────────
   POST /api/tasks   (protected — user, artist)
   Body: { pickup_address, pickup_city, pickup_state, pickup_pincode,
           dropoff_address, dropoff_city, dropoff_state, dropoff_pincode,
           item_ids[], estimated_weight_kg, item_description,
           scheduled_at?, is_urgent?, green_coins_reward, requester_notes? }
────────────────────────────────────────────── */
const createTask = async (req, res, next) => {
  try {
    const {
      pickup_address, pickup_city, pickup_state, pickup_pincode,
      pickup_lat, pickup_lng,
      dropoff_address, dropoff_city, dropoff_state, dropoff_pincode,
      dropoff_lat, dropoff_lng,
      item_ids = [],
      estimated_weight_kg = 0,
      item_description = "",
      scheduled_at,
      is_urgent = false,
      green_coins_reward = 10,
      requester_notes = "",
    } = req.body;

    let taskId;
    await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO tasks
           (requested_by,
            pickup_address,  pickup_city,  pickup_state,  pickup_pincode,  pickup_lat,  pickup_lng,
            dropoff_address, dropoff_city, dropoff_state, dropoff_pincode, dropoff_lat, dropoff_lng,
            estimated_weight_kg, item_description,
            scheduled_at, is_urgent, green_coins_reward, requester_notes)
         VALUES
           ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         RETURNING id`,
        [
          req.user.id,
          pickup_address,  pickup_city  || null, pickup_state  || null, pickup_pincode  || null,
          pickup_lat  ? parseFloat(pickup_lat)  : null,
          pickup_lng  ? parseFloat(pickup_lng)  : null,
          dropoff_address, dropoff_city || null, dropoff_state || null, dropoff_pincode || null,
          dropoff_lat ? parseFloat(dropoff_lat) : null,
          dropoff_lng ? parseFloat(dropoff_lng) : null,
          parseFloat(estimated_weight_kg) || 0,
          item_description,
          scheduled_at ? new Date(scheduled_at) : null,
          Boolean(is_urgent),
          parseInt(green_coins_reward) || 10,
          requester_notes,
        ]
      );
      taskId = rows[0].id;

      /* Link items */
      for (const itemId of item_ids) {
        await client.query(
          "INSERT INTO task_items (task_id, item_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
          [taskId, itemId]
        );
      }
    });

    const { rows } = await query(`${TASK_SELECT} WHERE t.id = $1`, [taskId]);
    const task = await enrichTask(rows[0]);
    res.status(201).json({ success: true, task });
  } catch (err) {
    next(err);
  }
};

/* ──────────────────────────────────────────────
   PUT /api/tasks/:id/assign   (protected — helper)
   Helper self-assigns an open pending task
────────────────────────────────────────────── */
const assignTask = async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE tasks
       SET assigned_helper = $1, status = 'assigned'
       WHERE id = $2 AND status = 'pending' AND assigned_helper IS NULL
       RETURNING id`,
      [req.user.id, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: "Task unavailable or already assigned." });
    }
    const { rows: updated } = await query(`${TASK_SELECT} WHERE t.id = $1`, [rows[0].id]);
    res.status(200).json({ success: true, message: "Task assigned.", task: updated[0] });
  } catch (err) {
    next(err);
  }
};

/* ──────────────────────────────────────────────
   PUT /api/tasks/:id/progress   (protected — assigned helper)
   Advance: assigned → collected → delivered
   Body: { actual_weight_kg?, helper_notes? }
────────────────────────────────────────────── */
const progressTask = async (req, res, next) => {
  try {
    const { rows: check } = await query(
      "SELECT * FROM tasks WHERE id = $1 AND assigned_helper = $2",
      [req.params.id, req.user.id]
    );
    if (check.length === 0) {
      return res.status(403).json({ success: false, message: "Task not found or not yours." });
    }
    const task = check[0];

    /* Status flow */
    const nextStatus = { assigned: "collected", collected: "delivered" }[task.status];
    if (!nextStatus) {
      return res.status(400).json({ success: false, message: `Cannot advance from "${task.status}".` });
    }

    const timestampField = nextStatus === "collected" ? "collected_at" : "delivered_at";
    const { actual_weight_kg, helper_notes } = req.body;

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE tasks
         SET status             = $1,
             ${timestampField}  = NOW(),
             actual_weight_kg   = COALESCE($2, actual_weight_kg),
             helper_notes       = COALESCE($3, helper_notes)
         WHERE id = $4`,
        [nextStatus, actual_weight_kg ? parseFloat(actual_weight_kg) : null, helper_notes || null, task.id]
      );

      /* When delivered: pay coins + update helper stats */
      if (nextStatus === "delivered" && !task.reward_paid) {
        await client.query(
          "UPDATE users SET green_coins = green_coins + $1 WHERE id = $2",
          [task.green_coins_reward, req.user.id]
        );

        const weight = actual_weight_kg
          ? parseFloat(actual_weight_kg)
          : (task.estimated_weight_kg || 0);

        await client.query(
          `UPDATE helper_profiles
           SET total_deliveries = total_deliveries + 1,
               total_waste_kg   = total_waste_kg   + $1
           WHERE user_id = $2`,
          [weight, req.user.id]
        );

        await client.query(
          `INSERT INTO transactions
             (from_user_id, to_user_id, type, task_id, green_coins, note)
           VALUES (NULL, $1, 'task_reward', $2, $3, $4)`,
          [
            req.user.id, task.id, task.green_coins_reward,
            `Delivery reward for Task #${task.id}`,
          ]
        );

        await client.query(
          "UPDATE tasks SET reward_paid = TRUE WHERE id = $1",
          [task.id]
        );
      }
    });

    const { rows } = await query(`${TASK_SELECT} WHERE t.id = $1`, [task.id]);
    const updated  = await enrichTask(rows[0]);
    res.status(200).json({
      success: true,
      message: `Task advanced to "${nextStatus}".`,
      task:    updated,
    });
  } catch (err) {
    next(err);
  }
};

/* ──────────────────────────────────────────────
   PUT /api/tasks/:id/cancel   (protected)
   Body: { reason? }
────────────────────────────────────────────── */
const cancelTask = async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE tasks
       SET status = 'cancelled', cancellation_reason = $1
       WHERE id = $2
         AND status NOT IN ('delivered','cancelled')
         AND (requested_by = $3 OR assigned_helper = $3)
       RETURNING id`,
      [req.body.reason || "Cancelled by user", req.params.id, req.user.id]
    );
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: "Cannot cancel this task." });
    }
    res.status(200).json({ success: true, message: "Task cancelled." });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getTasks, getTaskById, createTask, assignTask, progressTask, cancelTask,
};
