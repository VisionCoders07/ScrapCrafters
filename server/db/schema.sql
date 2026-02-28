-- ============================================================
--  schema.sql  —  SCRAP-CRAFTERS PostgreSQL Schema
--
--  Tables:
--    users              All platform users (user / artist / helper)
--    artist_profiles    Artist-specific extended profile
--    helper_profiles    Helper-specific extended profile
--    items              Scrap listings, donations, artworks
--    item_images        Up to 6 images per item (1-N)
--    tasks              Pickup / delivery tasks for helpers
--    task_items         Many-to-many: tasks ↔ items
--    transactions       Full financial + Green Coin ledger
--
--  Run:  psql -U postgres -d scrapcrafters -f schema.sql
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- trigram full-text search

-- ── Enum types ──────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user', 'artist', 'helper');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE item_category AS ENUM (
    'metal','plastic','e-waste','wood','glass',
    'paper','textile','rubber','ceramic','composite','artwork','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE listing_type AS ENUM ('sell','donate','scrap');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE item_condition AS ENUM ('new','like-new','good','fair','poor','scrap');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE item_status AS ENUM ('active','pending','sold','donated','collected','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('pending','assigned','collected','delivered','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vehicle_type AS ENUM ('cycle','bike','auto','van','on-foot');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE txn_type AS ENUM (
    'item_purchase','item_donation','task_reward',
    'coin_credit','coin_debit','withdrawal','refund'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE txn_status AS ENUM ('pending','completed','failed','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
--  TABLE: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL          PRIMARY KEY,
  name            VARCHAR(80)     NOT NULL,
  email           VARCHAR(255)    NOT NULL UNIQUE,
  password_hash   TEXT            NOT NULL,
  phone           VARCHAR(20),
  avatar_url      TEXT,
  role            user_role       NOT NULL DEFAULT 'user',
  green_coins     INTEGER         NOT NULL DEFAULT 0 CHECK (green_coins >= 0),

  -- address (denormalised for simplicity)
  street          VARCHAR(200),
  city            VARCHAR(100),
  state           VARCHAR(100),
  pincode         VARCHAR(20),

  is_verified     BOOLEAN         NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN         NOT NULL DEFAULT TRUE,

  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email  ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role   ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_city   ON users (city);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
--  TABLE: artist_profiles  (1-to-1 with users WHERE role = 'artist')
-- ============================================================
CREATE TABLE IF NOT EXISTS artist_profiles (
  user_id         INTEGER         PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio             VARCHAR(500),
  speciality      VARCHAR(120),
  portfolio_url   TEXT,
  total_earnings  NUMERIC(12,2)   NOT NULL DEFAULT 0,
  artworks_sold   INTEGER         NOT NULL DEFAULT 0,
  rating          NUMERIC(3,2)    NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  rating_count    INTEGER         NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_artist_profiles_updated_at ON artist_profiles;
CREATE TRIGGER trg_artist_profiles_updated_at
  BEFORE UPDATE ON artist_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
--  TABLE: helper_profiles  (1-to-1 with users WHERE role = 'helper')
-- ============================================================
CREATE TABLE IF NOT EXISTS helper_profiles (
  user_id             INTEGER         PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  vehicle_type        vehicle_type    NOT NULL DEFAULT 'on-foot',
  total_waste_kg      NUMERIC(10,2)   NOT NULL DEFAULT 0,
  total_deliveries    INTEGER         NOT NULL DEFAULT 0,
  current_address     VARCHAR(200),
  current_lat         NUMERIC(10,7),
  current_lng         NUMERIC(10,7),
  is_available        BOOLEAN         NOT NULL DEFAULT TRUE,
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_helper_profiles_updated_at ON helper_profiles;
CREATE TRIGGER trg_helper_profiles_updated_at
  BEFORE UPDATE ON helper_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
--  TABLE: items
-- ============================================================
CREATE TABLE IF NOT EXISTS items (
  id                  SERIAL          PRIMARY KEY,
  title               VARCHAR(120)    NOT NULL,
  description         TEXT,
  category            item_category   NOT NULL,
  listing_type        listing_type    NOT NULL,
  price               NUMERIC(10,2)   NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency            CHAR(3)         NOT NULL DEFAULT 'INR',
  is_negotiable       BOOLEAN         NOT NULL DEFAULT TRUE,
  weight_kg           NUMERIC(8,2),
  condition           item_condition  NOT NULL DEFAULT 'fair',
  -- dimensions (cm)
  dim_length          NUMERIC(8,2),
  dim_width           NUMERIC(8,2),
  dim_height          NUMERIC(8,2),
  -- location
  item_street         VARCHAR(200),
  item_city           VARCHAR(100),
  item_state          VARCHAR(100),
  item_pincode        VARCHAR(20),
  item_lat            NUMERIC(10,7),
  item_lng            NUMERIC(10,7),
  -- rewards + engagement
  green_coins_reward  INTEGER         NOT NULL DEFAULT 0 CHECK (green_coins_reward >= 0),
  views               INTEGER         NOT NULL DEFAULT 0 CHECK (views >= 0),
  saves               INTEGER         NOT NULL DEFAULT 0 CHECK (saves >= 0),
  -- ownership & lifecycle
  uploaded_by         INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bought_by           INTEGER         REFERENCES users(id) ON DELETE SET NULL,
  assigned_helper     INTEGER         REFERENCES users(id) ON DELETE SET NULL,
  status              item_status     NOT NULL DEFAULT 'active',
  sold_at             TIMESTAMPTZ,

  -- full-text search vector (populated by trigger)
  search_vector       TSVECTOR,

  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_items_status        ON items (status);
CREATE INDEX IF NOT EXISTS idx_items_category      ON items (category);
CREATE INDEX IF NOT EXISTS idx_items_listing_type  ON items (listing_type);
CREATE INDEX IF NOT EXISTS idx_items_uploaded_by   ON items (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_items_city          ON items (item_city);
CREATE INDEX IF NOT EXISTS idx_items_created_at    ON items (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_search        ON items USING GIN (search_vector);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_items_updated_at ON items;
CREATE TRIGGER trg_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Full-text search vector trigger
CREATE OR REPLACE FUNCTION update_item_search_vector()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')),       'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_items_search_vector ON items;
CREATE TRIGGER trg_items_search_vector
  BEFORE INSERT OR UPDATE OF title, description ON items
  FOR EACH ROW EXECUTE FUNCTION update_item_search_vector();

-- ============================================================
--  TABLE: item_tags  (normalised tags for items)
-- ============================================================
CREATE TABLE IF NOT EXISTS item_tags (
  item_id     INTEGER     NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  tag         VARCHAR(60) NOT NULL,
  PRIMARY KEY (item_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_item_tags_tag ON item_tags (tag);

-- ============================================================
--  TABLE: item_images  (up to 6 images per item)
-- ============================================================
CREATE TABLE IF NOT EXISTS item_images (
  id          SERIAL      PRIMARY KEY,
  item_id     INTEGER     NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  url         TEXT        NOT NULL,
  filename    VARCHAR(255),
  mimetype    VARCHAR(80),
  size_bytes  INTEGER,
  sort_order  SMALLINT    NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_item_images_item_id ON item_images (item_id, sort_order);

-- Enforce max 6 images per item
CREATE OR REPLACE FUNCTION check_max_images()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT COUNT(*) FROM item_images WHERE item_id = NEW.item_id) >= 6 THEN
    RAISE EXCEPTION 'An item cannot have more than 6 images';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_max_images ON item_images;
CREATE TRIGGER trg_check_max_images
  BEFORE INSERT ON item_images
  FOR EACH ROW EXECUTE FUNCTION check_max_images();

-- ============================================================
--  TABLE: tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id                    SERIAL          PRIMARY KEY,
  requested_by          INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_helper       INTEGER         REFERENCES users(id) ON DELETE SET NULL,

  -- locations
  pickup_address        VARCHAR(300)    NOT NULL,
  pickup_city           VARCHAR(100),
  pickup_state          VARCHAR(100),
  pickup_pincode        VARCHAR(20),
  pickup_lat            NUMERIC(10,7),
  pickup_lng            NUMERIC(10,7),

  dropoff_address       VARCHAR(300)    NOT NULL,
  dropoff_city          VARCHAR(100),
  dropoff_state         VARCHAR(100),
  dropoff_pincode       VARCHAR(20),
  dropoff_lat           NUMERIC(10,7),
  dropoff_lng           NUMERIC(10,7),

  -- physical
  estimated_weight_kg   NUMERIC(8,2)    DEFAULT 0,
  actual_weight_kg      NUMERIC(8,2),
  item_description      VARCHAR(500),

  -- scheduling
  scheduled_at          TIMESTAMPTZ,
  collected_at          TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,

  -- status
  status                task_status     NOT NULL DEFAULT 'pending',
  cancellation_reason   TEXT,

  -- flags
  is_urgent             BOOLEAN         NOT NULL DEFAULT FALSE,
  priority              SMALLINT        NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),

  -- rewards
  green_coins_reward    INTEGER         NOT NULL DEFAULT 10 CHECK (green_coins_reward >= 1),
  reward_paid           BOOLEAN         NOT NULL DEFAULT FALSE,

  -- distance
  distance_km           NUMERIC(7,2),

  -- notes
  helper_notes          TEXT,
  requester_notes       TEXT,

  created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status          ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_requested_by    ON tasks (requested_by);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_helper ON tasks (assigned_helper);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_at    ON tasks (scheduled_at);

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
--  TABLE: task_items  (many-to-many: tasks ↔ items)
-- ============================================================
CREATE TABLE IF NOT EXISTS task_items (
  task_id     INTEGER     NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  item_id     INTEGER     NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, item_id)
);

-- ============================================================
--  TABLE: transactions
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id              SERIAL          PRIMARY KEY,
  from_user_id    INTEGER         REFERENCES users(id) ON DELETE SET NULL,   -- NULL = platform
  to_user_id      INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            txn_type        NOT NULL,
  item_id         INTEGER         REFERENCES items(id) ON DELETE SET NULL,
  task_id         INTEGER         REFERENCES tasks(id) ON DELETE SET NULL,
  amount_inr      NUMERIC(12,2)   NOT NULL DEFAULT 0 CHECK (amount_inr >= 0),
  green_coins     INTEGER         NOT NULL DEFAULT 0,
  status          txn_status      NOT NULL DEFAULT 'completed',
  note            VARCHAR(300),
  payment_ref     VARCHAR(120),
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_txn_to_user   ON transactions (to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_txn_from_user ON transactions (from_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_txn_type      ON transactions (type, status);
