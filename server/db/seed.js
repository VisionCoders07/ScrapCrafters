// ============================================================
//  db/seed.js  —  Populate PostgreSQL with realistic seed data
//
//  Usage:
//    node db/seed.js           # skip if data exists
//    node db/seed.js --fresh   # truncate all tables first
//
//  Creates:
//    6 users  (2 users, 2 artists, 2 helpers)
//    11 items (scrap, artworks, donations)
//    3 tasks  (pending, collected, delivered)
//    4 transactions
// ============================================================
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { Pool }  = require("pg");
const bcrypt    = require("bcryptjs");

const pool = new Pool({
  host:     process.env.PGHOST     || "localhost",
  port:     parseInt(process.env.PGPORT || "5432"),
  database: process.env.PGDATABASE || "scrapcrafters",
  user:     process.env.PGUSER     || "postgres",
  password: process.env.PGPASSWORD || "root123",
});

/* ── Hash helper ── */
const hash = (plain) => bcrypt.hash(plain, 12);

/* ── Main seed function ── */
const seed = async () => {
  const isFresh = process.argv.includes("--fresh");
  const client  = await pool.connect();

  try {
    /* Guard: skip if data already exists */
    if (!isFresh) {
      const { rows } = await client.query("SELECT COUNT(*) FROM users");
      if (parseInt(rows[0].count) > 0) {
        console.log(`ℹ️   Database already has ${rows[0].count} user(s). Use --fresh to reseed.`);
        return;
      }
    }

    await client.query("BEGIN");

    if (isFresh) {
      console.log("🗑️   Truncating tables…");
      await client.query(`
        TRUNCATE
          transactions, task_items, tasks,
          item_images, item_tags, items,
          helper_profiles, artist_profiles, users
        RESTART IDENTITY CASCADE
      `);
      console.log("✅  Tables cleared.");
    }

    /* ── 1. USERS ─────────────────────────────────────────── */
    console.log("👤  Seeding users…");
    const PASSWORD = await hash("password123");

    const usersData = [
      // users
      {
        name: "Rahul Sharma",   email: "rahul@example.com",   role: "user",
        phone: "+919876543210", coins: 120,
        street: "12, MG Road", city: "Pune", state: "Maharashtra", pincode: "411001",
      },
      {
        name: "Meena Rathod",   email: "meena@example.com",   role: "user",
        phone: "+919765432109", coins: 85,
        street: "7, Baner Road", city: "Pune", state: "Maharashtra", pincode: "411045",
      },
      // artists
      {
        name: "Priya Kulkarni", email: "priya@example.com",   role: "artist",
        phone: "+919654321098", coins: 340,
        street: "Studio 4, FC Road", city: "Pune", state: "Maharashtra", pincode: "411004",
      },
      {
        name: "Dev Patil",      email: "dev@example.com",     role: "artist",
        phone: "+919543210987", coins: 210,
        street: "23, Koregaon Park", city: "Pune", state: "Maharashtra", pincode: "411001",
      },
      // helpers
      {
        name: "Ramesh Koli",    email: "ramesh@example.com",  role: "helper",
        phone: "+919432109876", coins: 680,
        street: "5, Hadapsar", city: "Pune", state: "Maharashtra", pincode: "411028",
      },
      {
        name: "Sushila Bai",    email: "sushila@example.com", role: "helper",
        phone: "+919321098765", coins: 420,
        street: "Katraj Area", city: "Pune", state: "Maharashtra", pincode: "411046",
      },
    ];

    const userIds = [];
    for (const u of usersData) {
      const { rows } = await client.query(
        `INSERT INTO users
           (name, email, password_hash, phone, role, green_coins,
            street, city, state, pincode)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id`,
        [u.name, u.email, PASSWORD, u.phone, u.role, u.coins,
         u.street, u.city, u.state, u.pincode]
      );
      userIds.push(rows[0].id);
    }
    console.log(`   ✅  ${userIds.length} users inserted (IDs: ${userIds.join(", ")})`);

    /* ── 2. ARTIST PROFILES ───────────────────────────────── */
    console.log("🎨  Seeding artist profiles…");
    await client.query(
      `INSERT INTO artist_profiles
         (user_id, bio, speciality, total_earnings, artworks_sold, rating, rating_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userIds[2],
       "I transform industrial waste into kinetic sculptures and wall art.",
       "metal sculpture", 28450, 14, 4.9, 82]
    );
    await client.query(
      `INSERT INTO artist_profiles
         (user_id, bio, speciality, total_earnings, artworks_sold, rating, rating_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userIds[3],
       "Circuit boards and e-waste become extraordinary digital art in my hands.",
       "e-waste digital art", 15200, 9, 4.7, 41]
    );

    /* ── 3. HELPER PROFILES ───────────────────────────────── */
    console.log("♻️   Seeding helper profiles…");
    await client.query(
      `INSERT INTO helper_profiles
         (user_id, vehicle_type, total_waste_kg, total_deliveries, is_available)
       VALUES ($1,$2,$3,$4,$5)`,
      [userIds[4], "bike", 128, 48, true]
    );
    await client.query(
      `INSERT INTO helper_profiles
         (user_id, vehicle_type, total_waste_kg, total_deliveries, is_available)
       VALUES ($1,$2,$3,$4,$5)`,
      [userIds[5], "on-foot", 72, 31, true]
    );

    /* ── 4. ITEMS ─────────────────────────────────────────── */
    console.log("📦  Seeding items…");

    const itemsData = [
      // scrap / sell listings by users
      {
        title: "Copper Wire Bundle",
        description: "Clean copper wire salvaged from old electrical wiring. Ideal for kinetic sculptures.",
        category: "metal", listing_type: "scrap",
        price: 80, weight_kg: 2, condition: "fair",
        green_coins_reward: 12, uploaded_by: userIds[0], status: "active",
        city: "Pune", state: "Maharashtra", pincode: "411001",
        tags: ["copper","wire","electrical"],
      },
      {
        title: "Old Circuit Boards (Mixed)",
        description: "Assorted PCBs from retired computers and appliances. Great for e-waste art.",
        category: "e-waste", listing_type: "scrap",
        price: 120, weight_kg: 1.5, condition: "poor",
        green_coins_reward: 18, uploaded_by: userIds[1], status: "active",
        city: "Pune", state: "Maharashtra", pincode: "411045",
        tags: ["pcb","circuit","electronics"],
      },
      {
        title: "Teak Wood Offcuts",
        description: "Small offcuts from a carpentry workshop. Varied sizes, good for mosaic or frame work.",
        category: "wood", listing_type: "scrap",
        price: 200, weight_kg: 10, condition: "good",
        green_coins_reward: 30, uploaded_by: userIds[0], status: "active",
        city: "Pune", state: "Maharashtra", pincode: "411001",
        tags: ["teak","wood","carpentry"],
      },
      {
        title: "PET Bottles (50 pcs)",
        description: "Cleaned and sorted 500ml PET bottles. Ready for upcycling or mosaic art.",
        category: "plastic", listing_type: "scrap",
        price: 45, weight_kg: 3, condition: "good",
        green_coins_reward: 8, uploaded_by: userIds[1], status: "active",
        city: "Pune", state: "Maharashtra", pincode: "411045",
        tags: ["pet","bottles","plastic"],
      },
      {
        title: "Iron Rods Assorted",
        description: "Mixed iron rods of various lengths from a construction site clearance.",
        category: "metal", listing_type: "scrap",
        price: 150, weight_kg: 5, condition: "fair",
        green_coins_reward: 22, uploaded_by: userIds[0], status: "active",
        city: "Pune", state: "Maharashtra", pincode: "411001",
        tags: ["iron","rods","construction"],
      },
      {
        title: "Old Newspapers Bulk",
        description: "Two months of newspapers, good for papier-mâché or packaging.",
        category: "paper", listing_type: "donate",
        price: 0, weight_kg: 8, condition: "fair",
        green_coins_reward: 5, uploaded_by: userIds[1], status: "active",
        city: "Pune", state: "Maharashtra", pincode: "411045",
        tags: ["newspaper","paper","bulk"],
      },
      {
        title: "Broken Clock Parts",
        description: "Gears, springs, and hands from 3 antique wall clocks. Great for steampunk art.",
        category: "metal", listing_type: "scrap",
        price: 60, weight_kg: 0.8, condition: "poor",
        green_coins_reward: 9, uploaded_by: userIds[0], status: "active",
        city: "Pune", state: "Maharashtra", pincode: "411001",
        tags: ["clock","gears","steampunk","antique"],
      },
      {
        title: "Cotton Fabric Scraps",
        description: "Assorted cotton remnants from a garment factory. Colourful and clean.",
        category: "textile", listing_type: "scrap",
        price: 55, weight_kg: 4, condition: "good",
        green_coins_reward: 7, uploaded_by: userIds[1], status: "active",
        city: "Pune", state: "Maharashtra", pincode: "411045",
        tags: ["cotton","fabric","textile"],
      },
      // artworks by artists
      {
        title: "Scrap Metal Kinetic Sculpture",
        description: "A balanced kinetic sculpture made entirely from reclaimed copper and iron. Moves with the wind.",
        category: "artwork", listing_type: "sell",
        price: 3500, weight_kg: 2.5, condition: "new",
        green_coins_reward: 50, uploaded_by: userIds[2], status: "active",
        city: "Pune", state: "Maharashtra", pincode: "411004",
        tags: ["sculpture","kinetic","copper","artwork"],
      },
      {
        title: "Circuit Board Mandala Wall Art",
        description: "Stunning 60cm mandala composed of salvaged circuit boards soldered into geometric patterns.",
        category: "artwork", listing_type: "sell",
        price: 2800, weight_kg: 1.2, condition: "new",
        green_coins_reward: 40, uploaded_by: userIds[3], status: "active",
        city: "Pune", state: "Maharashtra", pincode: "411001",
        tags: ["mandala","circuit","ewaste","wall art"],
      },
      // sold item for history demonstration
      {
        title: "Old Bicycle Frame",
        description: "Steel bicycle frame, suitable for upcycled furniture.",
        category: "metal", listing_type: "sell",
        price: 300, weight_kg: 7, condition: "fair",
        green_coins_reward: 15, uploaded_by: userIds[0],
        status: "sold", bought_by: userIds[2],
        city: "Pune", state: "Maharashtra", pincode: "411001",
        tags: ["bicycle","frame","steel"],
      },
    ];

    const itemIds = [];
    for (const item of itemsData) {
      const { rows } = await client.query(
        `INSERT INTO items
           (title, description, category, listing_type, price,
            weight_kg, condition, green_coins_reward,
            uploaded_by, status, bought_by,
            item_city, item_state, item_pincode)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING id`,
        [
          item.title, item.description, item.category, item.listing_type, item.price,
          item.weight_kg, item.condition, item.green_coins_reward,
          item.uploaded_by, item.status, item.bought_by || null,
          item.city, item.state, item.pincode,
        ]
      );
      const itemId = rows[0].id;
      itemIds.push(itemId);

      // Insert tags
      for (const tag of (item.tags || [])) {
        await client.query(
          "INSERT INTO item_tags (item_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [itemId, tag]
        );
      }
    }
    console.log(`   ✅  ${itemIds.length} items inserted`);

    /* ── 5. TASKS ─────────────────────────────────────────── */
    console.log("🚚  Seeding tasks…");

    const tasksData = [
      {
        requested_by: userIds[0], assigned_helper: userIds[4],
        pickup_address: "12, MG Road, Shivajinagar", pickup_city: "Pune", pickup_state: "Maharashtra", pickup_pincode: "411001",
        dropoff_address: "Studio 4, FC Road", dropoff_city: "Pune", dropoff_state: "Maharashtra", dropoff_pincode: "411004",
        estimated_weight_kg: 7, item_description: "Copper wire bundle and iron rods",
        is_urgent: true, status: "pending", green_coins_reward: 45, distance_km: 3.4,
        scheduled_at: new Date(Date.now() + 2 * 60 * 60 * 1000),
        items: [itemIds[0], itemIds[4]],
      },
      {
        requested_by: userIds[1], assigned_helper: userIds[4],
        pickup_address: "7, Baner Road, Baner", pickup_city: "Pune", pickup_state: "Maharashtra", pickup_pincode: "411045",
        dropoff_address: "EcoHub Warehouse, Aundh", dropoff_city: "Pune", dropoff_state: "Maharashtra", dropoff_pincode: "411007",
        estimated_weight_kg: 3, item_description: "PET Bottles",
        is_urgent: false, status: "collected", green_coins_reward: 28, distance_km: 2.1,
        scheduled_at: new Date(Date.now() + 60 * 60 * 1000),
        collected_at: new Date(Date.now() - 30 * 60 * 1000),
        items: [itemIds[3]],
      },
      {
        requested_by: userIds[0], assigned_helper: userIds[5],
        pickup_address: "23, Karve Nagar, Kothrud", pickup_city: "Pune", pickup_state: "Maharashtra", pickup_pincode: "411038",
        dropoff_address: "Creative Collective, Kasba Peth", dropoff_city: "Pune", dropoff_state: "Maharashtra", dropoff_pincode: "411011",
        estimated_weight_kg: 0.8, actual_weight_kg: 0.9, item_description: "Clock parts and metal scraps",
        is_urgent: false, status: "delivered", green_coins_reward: 35, distance_km: 5.7,
        reward_paid: true,
        scheduled_at: new Date(Date.now() - 5 * 60 * 60 * 1000),
        collected_at: new Date(Date.now() - 4 * 60 * 60 * 1000),
        delivered_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
        items: [itemIds[6]],
      },
    ];

    const taskIds = [];
    for (const t of tasksData) {
      const { rows } = await client.query(
        `INSERT INTO tasks
           (requested_by, assigned_helper,
            pickup_address, pickup_city, pickup_state, pickup_pincode,
            dropoff_address, dropoff_city, dropoff_state, dropoff_pincode,
            estimated_weight_kg, actual_weight_kg, item_description,
            is_urgent, status, green_coins_reward, reward_paid,
            distance_km, scheduled_at, collected_at, delivered_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         RETURNING id`,
        [
          t.requested_by, t.assigned_helper,
          t.pickup_address, t.pickup_city, t.pickup_state, t.pickup_pincode,
          t.dropoff_address, t.dropoff_city, t.dropoff_state, t.dropoff_pincode,
          t.estimated_weight_kg, t.actual_weight_kg || null, t.item_description,
          t.is_urgent, t.status, t.green_coins_reward, t.reward_paid || false,
          t.distance_km, t.scheduled_at || null, t.collected_at || null, t.delivered_at || null,
        ]
      );
      const taskId = rows[0].id;
      taskIds.push(taskId);

      // Link items to task
      for (const itemId of (t.items || [])) {
        await client.query(
          "INSERT INTO task_items (task_id, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [taskId, itemId]
        );
      }
    }
    console.log(`   ✅  ${taskIds.length} tasks inserted`);

    /* ── 6. TRANSACTIONS ──────────────────────────────────── */
    console.log("💰  Seeding transactions…");

    const txnsData = [
      // welcome coins for each user
      { from_user_id: null, to_user_id: userIds[0], type: "coin_credit", green_coins: 50,  note: "Welcome bonus" },
      { from_user_id: null, to_user_id: userIds[1], type: "coin_credit", green_coins: 50,  note: "Welcome bonus" },
      { from_user_id: null, to_user_id: userIds[2], type: "coin_credit", green_coins: 80,  note: "Welcome bonus" },
      { from_user_id: null, to_user_id: userIds[3], type: "coin_credit", green_coins: 80,  note: "Welcome bonus" },
      { from_user_id: null, to_user_id: userIds[4], type: "coin_credit", green_coins: 100, note: "Welcome bonus" },
      { from_user_id: null, to_user_id: userIds[5], type: "coin_credit", green_coins: 100, note: "Welcome bonus" },
      // purchase
      {
        from_user_id: userIds[2], to_user_id: userIds[0], type: "item_purchase",
        item_id: itemIds[10], amount_inr: 300, green_coins: 15,
        note: "Purchase of Old Bicycle Frame",
      },
      // task reward (delivered task)
      {
        from_user_id: null, to_user_id: userIds[5], type: "task_reward",
        task_id: taskIds[2], green_coins: 35,
        note: `Delivery reward for Task #${taskIds[2]}`,
      },
    ];

    for (const t of txnsData) {
      await client.query(
        `INSERT INTO transactions
           (from_user_id, to_user_id, type, item_id, task_id,
            amount_inr, green_coins, status, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'completed',$8)`,
        [
          t.from_user_id || null, t.to_user_id, t.type,
          t.item_id || null, t.task_id || null,
          t.amount_inr || 0, t.green_coins || 0, t.note || "",
        ]
      );
    }
    console.log(`   ✅  ${txnsData.length} transactions inserted`);

    await client.query("COMMIT");

    /* ── Summary ── */
    console.log("\n🌿  Seed complete!");
    console.log("────────────────────────────────────────");
    console.log("  Users:        6  (2 users, 2 artists, 2 helpers)");
    console.log("  Items:        11 (scrap, artworks, sold)");
    console.log("  Tasks:        3  (pending, collected, delivered)");
    console.log(`  Transactions: ${txnsData.length}`);
    console.log("\n  Test credentials (all passwords: password123):");
    console.log("  [user  ] rahul@example.com");
    console.log("  [user  ] meena@example.com");
    console.log("  [artist] priya@example.com");
    console.log("  [artist] dev@example.com");
    console.log("  [helper] ramesh@example.com");
    console.log("  [helper] sushila@example.com");
    console.log("────────────────────────────────────────");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌  Seed failed:", err.message);
    if (err.detail) console.error("    Detail:", err.detail);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

seed();
