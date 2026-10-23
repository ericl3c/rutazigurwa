UPDATE family_members SET member_code = 'RUT-' || substring(member_code from 5) WHERE member_code LIKE 'FAM-%';
ALTER TABLE family_members ALTER COLUMN member_code SET DEFAULT ('RUT-' || lpad(nextval('member_code_seq')::text, 3, '0'));
