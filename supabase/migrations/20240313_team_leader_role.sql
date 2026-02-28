-- ============================================================
-- Team Leader Role + team_leader_id assignment
-- ============================================================

-- 1. Expand the role constraint to include 'team_leader'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'team_leader', 'counsellor'));

-- 2. Add team_leader_id FK so counsellors can be assigned to a team leader
ALTER TABLE users ADD COLUMN IF NOT EXISTS team_leader_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_team_leader ON users(team_leader_id);

-- 3. Team-wise aggregate stats for admin dashboard
CREATE OR REPLACE FUNCTION get_team_stats(p_college_id UUID)
RETURNS TABLE(
  team_leader_id UUID,
  total_counsellors BIGINT,
  total_leads BIGINT,
  enrolled BIGINT,
  interested BIGINT,
  not_called BIGINT
)
SECURITY DEFINER
LANGUAGE SQL STABLE AS $$
  SELECT
    u.team_leader_id,
    COUNT(DISTINCT u.id)                                                       AS total_counsellors,
    COUNT(l.id)                                                                AS total_leads,
    COUNT(CASE WHEN l.current_lead_stage = 'Enrolled'         THEN 1 END)     AS enrolled,
    COUNT(CASE WHEN l.current_call_stage = 'Interested'       THEN 1 END)     AS interested,
    COUNT(CASE WHEN l.current_call_stage IS NULL AND l.id IS NOT NULL THEN 1 END) AS not_called
  FROM users u
  LEFT JOIN leads l ON l.assigned_to = u.id AND l.is_active = true AND l.college_id = p_college_id
  WHERE u.college_id = p_college_id
    AND u.role       = 'counsellor'
    AND u.team_leader_id IS NOT NULL
    AND u.is_active  = true
  GROUP BY u.team_leader_id;
$$;
