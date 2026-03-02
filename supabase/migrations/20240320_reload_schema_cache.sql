-- ============================================================
-- Reload PostgREST schema cache
--
-- After migrations that add new columns (course_id, school_name,
-- visit_date on leads; courses table), PostgREST must be told to
-- re-read the PostgreSQL schema.  Without this, PATCH/POST requests
-- that include the new columns return 500 because PostgREST's cached
-- schema still doesn't know those columns exist.
--
-- Run this migration in the Supabase SQL editor, OR use:
--   NOTIFY pgrst, 'reload schema';
-- from any connected psql/dashboard session.
-- ============================================================

-- Signal PostgREST to drop and rebuild its schema cache.
NOTIFY pgrst, 'reload schema';
