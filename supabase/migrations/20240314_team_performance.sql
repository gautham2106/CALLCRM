-- ============================================================
-- Team Performance Analytics
-- Richer per-team aggregation covering the full conversion funnel
-- ============================================================

CREATE OR REPLACE FUNCTION get_team_performance(p_college_id UUID, p_today DATE)
RETURNS TABLE(
  team_leader_id    UUID,
  team_leader_name  TEXT,
  total_counsellors BIGINT,
  total_leads       BIGINT,
  called            BIGINT,
  not_called        BIGINT,
  interested        BIGINT,
  not_interested    BIGINT,
  visit_done        BIGINT,
  enrolled          BIGINT,
  cold_wrong        BIGINT,
  stale             BIGINT,
  followups_today   BIGINT
)
SECURITY DEFINER
LANGUAGE SQL STABLE AS $$
  SELECT
    tl.id                                                                                    AS team_leader_id,
    tl.name                                                                                  AS team_leader_name,
    COUNT(DISTINCT c.id)                                                                     AS total_counsellors,
    COUNT(l.id)        FILTER (WHERE l.is_active = true)                                     AS total_leads,
    COUNT(l.id)        FILTER (WHERE l.is_active = true AND l.current_call_stage IS NOT NULL) AS called,
    COUNT(l.id)        FILTER (WHERE l.is_active = true AND l.current_call_stage IS NULL)     AS not_called,
    COUNT(l.id)        FILTER (WHERE l.is_active = true AND l.current_call_stage = 'Interested')     AS interested,
    COUNT(l.id)        FILTER (WHERE l.is_active = true AND l.current_call_stage = 'Not Interested') AS not_interested,
    COUNT(l.id)        FILTER (WHERE l.is_active = true
                                AND l.current_lead_stage IN ('Visit Done', 'Application Started', 'Enrolled')) AS visit_done,
    COUNT(l.id)        FILTER (WHERE l.is_active = true AND l.current_lead_stage = 'Enrolled')             AS enrolled,
    COUNT(l.id)        FILTER (WHERE l.is_active = true AND l.current_lead_stage IN ('Cold Lead', 'Wrong Lead')) AS cold_wrong,
    COUNT(l.id)        FILTER (WHERE l.is_active = true
                                AND l.updated_at < NOW() - INTERVAL '3 days'
                                AND l.current_lead_stage NOT IN ('Enrolled', 'Cold Lead', 'Wrong Lead')) AS stale,
    COUNT(l.id)        FILTER (WHERE l.is_active = true AND l.follow_up_date = p_today)      AS followups_today
  FROM users tl
  LEFT JOIN users c  ON c.team_leader_id = tl.id
                     AND c.college_id    = p_college_id
                     AND c.role          = 'counsellor'
                     AND c.is_active     = true
  LEFT JOIN leads l  ON l.assigned_to   = c.id
                     AND l.college_id   = p_college_id
  WHERE tl.role       = 'team_leader'
    AND tl.college_id = p_college_id
    AND tl.is_active  = true
  GROUP BY tl.id, tl.name
  ORDER BY COUNT(l.id) FILTER (WHERE l.is_active = true AND l.current_lead_stage = 'Enrolled') DESC;
$$;
