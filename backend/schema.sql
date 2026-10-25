-- RUTAZIGURWA production schema for a fresh, empty Neon database.
-- Paste this whole file into the Neon SQL Editor and run it once.
-- It adds the schema and application defaults only: no members and no admin account.
-- Create the administrator separately with: npm run create-admin
-- PostgreSQL 13+

BEGIN;

CREATE TABLE schema_migrations (
  name       TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TABLE admins (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE member_code_seq START 1;

CREATE TABLE family_members (
  id           SERIAL PRIMARY KEY,
  member_code  VARCHAR(20) NOT NULL UNIQUE
               DEFAULT ('RUT-' || lpad(nextval('member_code_seq')::text, 3, '0')),
  full_name    VARCHAR(100) NOT NULL CHECK (length(trim(full_name)) > 0),
  gender       VARCHAR(10) NOT NULL CHECK (gender IN ('male','female')),
  phone_number VARCHAR(30),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_members_gender_active ON family_members (gender, is_active);

CREATE TABLE lottery_settings (
  id                   SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  round_number         INTEGER NOT NULL DEFAULT 1 CHECK (round_number >= 1),
  status               VARCHAR(15) NOT NULL DEFAULT 'not_started'
                       CHECK (status IN ('not_started','open','paused','closed')),
  matching_mode        VARCHAR(15) NOT NULL DEFAULT 'one_to_one'
                       CHECK (matching_mode IN ('one_to_one','open')),
  mismatch_approved    BOOLEAN NOT NULL DEFAULT FALSE,
  mismatch_approved_at TIMESTAMPTZ,
  started_at           TIMESTAMPTZ,
  closed_at            TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO lottery_settings (id) VALUES (1);

CREATE TABLE draws (
  id                 SERIAL PRIMARY KEY,
  participant_id     INTEGER NOT NULL REFERENCES family_members(id),
  assigned_member_id INTEGER NOT NULL REFERENCES family_members(id),
  round_number       INTEGER NOT NULL DEFAULT 1 CHECK (round_number >= 1),
  matching_mode      VARCHAR(15) NOT NULL CHECK (matching_mode IN ('one_to_one','open')),
  drawn_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (participant_id <> assigned_member_id)
);
CREATE UNIQUE INDEX uq_draws_participant_round
  ON draws (round_number, participant_id);
CREATE UNIQUE INDEX uq_draws_assigned_one_to_one_round
  ON draws (round_number, assigned_member_id) WHERE matching_mode = 'one_to_one';

CREATE FUNCTION enforce_draw_rules() RETURNS trigger AS $$
DECLARE p family_members; a family_members;
BEGIN
  SELECT * INTO p FROM family_members WHERE id = NEW.participant_id;
  SELECT * INTO a FROM family_members WHERE id = NEW.assigned_member_id;
  IF p.gender = a.gender THEN
    RAISE EXCEPTION 'Draw must be between opposite genders';
  END IF;
  IF NOT p.is_active OR NOT a.is_active THEN
    RAISE EXCEPTION 'Both members must be active';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_draw_rules BEFORE INSERT ON draws
  FOR EACH ROW EXECUTE FUNCTION enforce_draw_rules();

CREATE TABLE audit_logs (
  id          SERIAL PRIMARY KEY,
  admin_id    INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  action      VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40),
  entity_id   VARCHAR(40),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON audit_logs (created_at DESC);

CREATE TABLE sessions (
  sid    VARCHAR PRIMARY KEY,
  sess   JSON NOT NULL,
  expire TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_sessions_expire ON sessions (expire);

CREATE TRIGGER trg_admins_upd   BEFORE UPDATE ON admins           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_members_upd  BEFORE UPDATE ON family_members   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_settings_upd BEFORE UPDATE ON lottery_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Keep IDs consistent with the current member-code format.
UPDATE family_members SET member_code = 'RUT-' || substring(member_code from 5) WHERE member_code LIKE 'FAM-%';
ALTER TABLE family_members ALTER COLUMN member_code SET DEFAULT ('RUT-' || lpad(nextval('member_code_seq')::text, 3, '0'));

-- Phone numbers are unique by digits, ignoring spaces and punctuation.
CREATE UNIQUE INDEX idx_family_members_phone_digits_unique
  ON family_members (regexp_replace(phone_number, '[^0-9]', '', 'g'))
  WHERE phone_number IS NOT NULL
    AND regexp_replace(phone_number, '[^0-9]', '', 'g') <> '';

INSERT INTO schema_migrations (name) VALUES
  ('001_init.sql'),
  ('002_member_code_prefix.sql'),
  ('003_lottery_rounds.sql'),
  ('003_unique_member_phone.sql');

COMMIT;
