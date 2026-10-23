BEGIN;
ALTER TABLE lottery_settings
  ADD COLUMN round_number INTEGER NOT NULL DEFAULT 1 CHECK (round_number >= 1);
ALTER TABLE draws
  ADD COLUMN round_number INTEGER NOT NULL DEFAULT 1 CHECK (round_number >= 1);
ALTER TABLE draws DROP CONSTRAINT IF EXISTS draws_participant_id_key;
DROP INDEX IF EXISTS uq_draws_assigned_one_to_one;
CREATE UNIQUE INDEX uq_draws_participant_round
  ON draws (round_number, participant_id);
CREATE UNIQUE INDEX uq_draws_assigned_one_to_one_round
  ON draws (round_number, assigned_member_id)
  WHERE matching_mode = 'one_to_one';
COMMIT;