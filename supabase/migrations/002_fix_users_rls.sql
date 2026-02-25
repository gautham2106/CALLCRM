-- ============================================================
-- Fix users table RLS policies
-- The original "users_own_record" FOR ALL policy blocked admins
-- from reading, inserting, and updating other users in their college.
-- ============================================================

-- Security-definer helper functions avoid circular RLS dependency
-- (querying users inside a users policy would cause infinite recursion)
CREATE OR REPLACE FUNCTION get_my_college_id()
RETURNS UUID AS $$
  SELECT college_id FROM users WHERE auth_id = auth.uid() LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Drop the old catch-all policy
DROP POLICY IF EXISTS "users_own_record" ON users;

-- Any authenticated user can read their own row
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = auth_id);

-- Admins can read all users in their college (e.g. to list counsellors)
CREATE POLICY "users_admin_select_college" ON users
  FOR SELECT USING (
    get_my_role() = 'admin'
    AND college_id = get_my_college_id()
  );

-- Admins can insert new users (counsellors) into their college
CREATE POLICY "users_admin_insert" ON users
  FOR INSERT WITH CHECK (
    get_my_role() = 'admin'
    AND college_id = get_my_college_id()
  );

-- Admins can update users (e.g. toggle is_active) within their college
CREATE POLICY "users_admin_update" ON users
  FOR UPDATE USING (
    get_my_role() = 'admin'
    AND college_id = get_my_college_id()
  );

-- Users can update their own profile
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = auth_id);
