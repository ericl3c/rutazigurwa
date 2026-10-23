BEGIN;
DROP TABLE IF EXISTS sessions, audit_logs, draws, lottery_settings, family_members, admins CASCADE;
DROP FUNCTION IF EXISTS enforce_draw_rules(), set_updated_at() CASCADE;
DROP SEQUENCE IF EXISTS member_code_seq;
COMMIT;
