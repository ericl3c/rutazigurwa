-- Phone values are unique after removing spaces and punctuation. Empty phone
-- numbers stay optional and do not participate in the unique index.
CREATE UNIQUE INDEX idx_family_members_phone_digits_unique
  ON family_members (regexp_replace(phone_number, '[^0-9]', '', 'g'))
  WHERE phone_number IS NOT NULL
    AND regexp_replace(phone_number, '[^0-9]', '', 'g') <> '';
