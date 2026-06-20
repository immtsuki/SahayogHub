-- ============================================================
--  LostLink AI — Full Database Schema
--  SahayogHub · Lost & Found Module
--  PostgreSQL 15+ compatible
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- postgis skipped (not available on Neon free tier)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- for fuzzy text search

-- ============================================================
--  ENUMS
-- ============================================================

CREATE TYPE item_status AS ENUM ('lost', 'found', 'resolved', 'archived');

CREATE TYPE item_category AS ENUM (
  'bags_luggage', 'electronics', 'pets', 'documents',
  'vehicles', 'clothing', 'keys', 'jewellery', 'other'
);

CREATE TYPE badge_type AS ENUM (
  'top_finder', 'community_helper', 'verified_user', 'trusted_user'
);

CREATE TYPE match_status AS ENUM ('pending', 'confirmed', 'dismissed');

CREATE TYPE notification_type AS ENUM (
  'ai_match', 'message', 'item_resolved', 'badge_awarded', 'nearby_item'
);

CREATE TYPE auth_provider AS ENUM ('email', 'google', 'facebook', 'guest');

CREATE TYPE activity_type AS ENUM (
  'item_posted', 'item_resolved', 'match_confirmed',
  'message_sent', 'badge_earned', 'item_saved'
);

-- ============================================================
--  USERS
-- ============================================================

CREATE TABLE users (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name         VARCHAR(100) NOT NULL,
  email             VARCHAR(255) UNIQUE NOT NULL,
  password_hash     TEXT,                          -- NULL for OAuth users
  avatar_url        TEXT,
  trust_score       NUMERIC(4,1) DEFAULT 0.0,      -- shown as "4.8 Trust Score"
  lost_posted       INTEGER      DEFAULT 0,
  found_posted      INTEGER      DEFAULT 0,
  recoveries        INTEGER      DEFAULT 0,
  is_verified       BOOLEAN      DEFAULT FALSE,    -- verified badge
  auth_provider     auth_provider DEFAULT 'email',
  last_known_lat    NUMERIC(10,7),
  last_known_lng    NUMERIC(10,7),
  created_at        TIMESTAMPTZ  DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_trust ON users(trust_score DESC);

-- ============================================================
--  REPUTATION BADGES
-- ============================================================

CREATE TABLE reputation_badges (
  id          UUID       PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_type  badge_type NOT NULL,
  awarded_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, badge_type)             -- one of each badge per user
);

CREATE INDEX idx_badges_user ON reputation_badges(user_id);

-- ============================================================
--  ITEMS  (Lost & Found posts)
-- ============================================================

CREATE TABLE items (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(200)  NOT NULL,
  description     TEXT,
  status          item_status   NOT NULL DEFAULT 'lost',
  category        item_category NOT NULL DEFAULT 'other',
  color           VARCHAR(50),
  brand           VARCHAR(100),
  latitude        NUMERIC(10,7),
  longitude       NUMERIC(10,7),
  location_label  VARCHAR(200),              -- "Downtown, 1.2 mi away"
  image_urls      TEXT[]         DEFAULT '{}',
  -- AI fields (populated after scan)
  ai_scanned      BOOLEAN        DEFAULT FALSE,
  -- Counters
  view_count      INTEGER        DEFAULT 0,
  reported_at     TIMESTAMPTZ    DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ    DEFAULT NOW()
);

CREATE INDEX idx_items_user      ON items(user_id);
CREATE INDEX idx_items_status    ON items(status);
CREATE INDEX idx_items_category  ON items(category);
CREATE INDEX idx_items_location  ON items(latitude, longitude);
CREATE INDEX idx_items_reported  ON items(reported_at DESC);

-- Full-text search index on title + description
CREATE INDEX idx_items_fts ON items
  USING GIN(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')));

-- ============================================================
--  AI ANALYSIS  (per item, 1-to-1)
-- ============================================================

CREATE TABLE ai_analysis (
  id                  UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id             UUID    UNIQUE NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  detected_category   VARCHAR(100),
  detected_color      VARCHAR(50),
  detected_brand      VARCHAR(100),
  confidence_pct      SMALLINT CHECK (confidence_pct BETWEEN 0 AND 100),
  raw_response        JSONB,                 -- full AI model output
  analyzed_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_item ON ai_analysis(item_id);

-- ============================================================
--  AI MATCHES  (lost ↔ found pairing)
-- ============================================================

CREATE TABLE ai_matches (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  lost_item_id    UUID         NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  found_item_id   UUID         NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  match_score_pct SMALLINT     CHECK (match_score_pct BETWEEN 0 AND 100),
  match_status    match_status DEFAULT 'pending',
  matched_at      TIMESTAMPTZ  DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ,
  UNIQUE (lost_item_id, found_item_id)
);

CREATE INDEX idx_matches_lost    ON ai_matches(lost_item_id);
CREATE INDEX idx_matches_found   ON ai_matches(found_item_id);
CREATE INDEX idx_matches_score   ON ai_matches(match_score_pct DESC);
CREATE INDEX idx_matches_status  ON ai_matches(match_status);

-- ============================================================
--  MESSAGES  (in-app chat between users about an item)
-- ============================================================

CREATE TABLE messages (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id   UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id     UUID    REFERENCES items(id) ON DELETE SET NULL,
  content     TEXT    NOT NULL,
  is_read     BOOLEAN DEFAULT FALSE,
  sent_at     TIMESTAMPTZ DEFAULT NOW(),
  CHECK (sender_id <> receiver_id)
);

CREATE INDEX idx_messages_sender   ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_item     ON messages(item_id);
CREATE INDEX idx_messages_unread   ON messages(receiver_id) WHERE is_read = FALSE;

-- ============================================================
--  NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id          UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  title       VARCHAR(200),
  body        TEXT,
  ref_id      UUID,              -- item_id, match_id, or message_id
  ref_type    VARCHAR(50),       -- 'item' | 'match' | 'message'
  is_read     BOOLEAN            DEFAULT FALSE,
  created_at  TIMESTAMPTZ        DEFAULT NOW()
);

CREATE INDEX idx_notif_user   ON notifications(user_id);
CREATE INDEX idx_notif_unread ON notifications(user_id) WHERE is_read = FALSE;

-- ============================================================
--  SAVED ITEMS  (bookmarks — Screen 6 "Saved" tab)
-- ============================================================

CREATE TABLE saved_items (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id   UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  saved_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, item_id)
);

CREATE INDEX idx_saved_user ON saved_items(user_id);
CREATE INDEX idx_saved_item ON saved_items(item_id);

-- ============================================================
--  ACTIVITY LOG  (Screen 6 "Activity" tab)
-- ============================================================

CREATE TABLE activity_log (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type  activity_type NOT NULL,
  ref_id       UUID,           -- item_id, match_id, etc.
  ref_type     VARCHAR(50),
  created_at   TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX idx_activity_user ON activity_log(user_id);
CREATE INDEX idx_activity_time ON activity_log(created_at DESC);

-- ============================================================
--  HELPER FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Increment user counters when item status changes
CREATE OR REPLACE FUNCTION sync_user_item_counts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'lost' THEN
      UPDATE users SET lost_posted = lost_posted + 1 WHERE id = NEW.user_id;
    ELSIF NEW.status = 'found' THEN
      UPDATE users SET found_posted = found_posted + 1 WHERE id = NEW.user_id;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'resolved' AND NEW.status = 'resolved' THEN
      UPDATE users SET recoveries = recoveries + 1 WHERE id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_item_count_sync
  AFTER INSERT OR UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION sync_user_item_counts();

-- ============================================================
--  USEFUL VIEWS
-- ============================================================

-- Feed view (Screen 2 & 8): items with owner info and AI confidence
CREATE VIEW item_feed AS
SELECT
  i.id,
  i.title,
  i.status,
  i.category,
  i.color,
  i.brand,
  i.latitude,
  i.longitude,
  i.location_label,
  i.image_urls,
  i.reported_at,
  u.id           AS user_id,
  u.full_name    AS user_name,
  u.avatar_url   AS user_avatar,
  u.trust_score,
  a.confidence_pct AS ai_confidence
FROM items i
JOIN users u ON u.id = i.user_id
LEFT JOIN ai_analysis a ON a.item_id = i.id
WHERE i.status IN ('lost', 'found')
ORDER BY i.reported_at DESC;

-- Match discovery view (Screen 4 & 10): ranked AI matches with both items
CREATE VIEW match_discovery AS
SELECT
  m.id            AS match_id,
  m.match_score_pct,
  m.match_status,
  m.matched_at,
  l.id            AS lost_item_id,
  l.title         AS lost_title,
  l.image_urls    AS lost_images,
  l.location_label AS lost_location,
  f.id            AS found_item_id,
  f.title         AS found_title,
  f.image_urls    AS found_images,
  f.location_label AS found_location
FROM ai_matches m
JOIN items l ON l.id = m.lost_item_id
JOIN items f ON f.id = m.found_item_id
ORDER BY m.match_score_pct DESC;

-- User profile view (Screen 6 & 12)
CREATE VIEW user_profile AS
SELECT
  u.*,
  ARRAY_AGG(DISTINCT rb.badge_type) FILTER (WHERE rb.badge_type IS NOT NULL) AS badges
FROM users u
LEFT JOIN reputation_badges rb ON rb.user_id = u.id
GROUP BY u.id;

-- ============================================================
--  SAMPLE DATA (for development/testing)
-- ============================================================

INSERT INTO users (full_name, email, password_hash, trust_score, lost_posted, found_posted, recoveries, is_verified)
VALUES
  ('Maya Chen',    'maya@example.com',   'hashed_pw_1', 4.8, 12, 8, 6, TRUE),
  ('Daniel Reyes', 'daniel@example.com', 'hashed_pw_2', 4.2, 5,  3, 2, FALSE),
  ('Jordan Blake', 'jordan@example.com', 'hashed_pw_3', 4.8, 12, 8, 6, TRUE);

-- Badges for Maya
INSERT INTO reputation_badges (user_id, badge_type)
SELECT id, 'top_finder'        FROM users WHERE email = 'maya@example.com'
UNION ALL
SELECT id, 'community_helper'  FROM users WHERE email = 'maya@example.com'
UNION ALL
SELECT id, 'verified_user'     FROM users WHERE email = 'maya@example.com';

-- Sample items
INSERT INTO items (user_id, title, description, status, category, color, brand, latitude, longitude, location_label, image_urls, ai_scanned)
SELECT
  id,
  'Black Nike Backpack',
  'Black Nike branded backpack with multiple compartments and padded straps. Last seen with a small keychain attached to the front zipper.',
  'lost',
  'bags_luggage',
  'Black',
  'Nike',
  40.7580,
  -73.9855,
  'Downtown, 1.2 mi away',
  ARRAY['https://example.com/backpack1.jpg'],
  TRUE
FROM users WHERE email = 'maya@example.com';
