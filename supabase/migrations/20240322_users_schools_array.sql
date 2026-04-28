-- Replace school_counsellor_mappings table with a schools TEXT[] column on users.
-- Each counsellor row now owns the list of schools assigned to them directly.

ALTER TABLE users ADD COLUMN IF NOT EXISTS schools TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_users_schools ON users USING GIN(schools);
