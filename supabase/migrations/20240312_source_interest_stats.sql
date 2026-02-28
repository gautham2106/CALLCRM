-- ============================================================
-- Source-wise stats per counsellor + Interest analytics
-- ============================================================

-- 1. Source-wise stats for a specific counsellor
CREATE OR REPLACE FUNCTION get_counsellor_source_stats(
  p_college_id UUID,
  p_counsellor_id UUID
)
RETURNS TABLE(
  source_name    TEXT,
  total          BIGINT,
  called         BIGINT,
  interested     BIGINT,
  not_interested BIGINT,
  enrolled       BIGINT
)
SECURITY DEFINER
LANGUAGE SQL STABLE AS $$
  SELECT
    COALESCE(l.source_name, 'Unknown')                                        AS source_name,
    COUNT(*)                                                                   AS total,
    COUNT(CASE WHEN l.current_call_stage IS NOT NULL           THEN 1 END)    AS called,
    COUNT(CASE WHEN l.current_call_stage = 'Interested'        THEN 1 END)    AS interested,
    COUNT(CASE WHEN l.current_call_stage = 'Not Interested'    THEN 1 END)    AS not_interested,
    COUNT(CASE WHEN l.current_lead_stage = 'Enrolled'          THEN 1 END)    AS enrolled
  FROM leads l
  WHERE l.college_id  = p_college_id
    AND l.assigned_to = p_counsellor_id
    AND l.is_active   = true
  GROUP BY COALESCE(l.source_name, 'Unknown');
$$;

-- 2. School-wise interest stats
CREATE OR REPLACE FUNCTION get_school_interest_stats(p_college_id UUID)
RETURNS TABLE(
  school_name    TEXT,
  total          BIGINT,
  interested     BIGINT,
  not_interested BIGINT,
  enrolled       BIGINT
)
SECURITY DEFINER
LANGUAGE SQL STABLE AS $$
  SELECT
    COALESCE(l.school_name, 'Unknown')                                        AS school_name,
    COUNT(*)                                                                   AS total,
    COUNT(CASE WHEN l.current_call_stage = 'Interested'       THEN 1 END)    AS interested,
    COUNT(CASE WHEN l.current_call_stage = 'Not Interested'   THEN 1 END)    AS not_interested,
    COUNT(CASE WHEN l.current_lead_stage = 'Enrolled'         THEN 1 END)    AS enrolled
  FROM leads l
  WHERE l.college_id = p_college_id
    AND l.is_active  = true
    AND l.school_name IS NOT NULL
  GROUP BY COALESCE(l.school_name, 'Unknown');
$$;

-- 3. Counsellor-wise interest stats (for detecting abnormal not-interested ratios)
CREATE OR REPLACE FUNCTION get_counsellor_interest_stats(p_college_id UUID)
RETURNS TABLE(
  counsellor_id  UUID,
  total_called   BIGINT,
  interested     BIGINT,
  not_interested BIGINT
)
SECURITY DEFINER
LANGUAGE SQL STABLE AS $$
  SELECT
    l.assigned_to                                                              AS counsellor_id,
    COUNT(CASE WHEN l.current_call_stage IS NOT NULL           THEN 1 END)    AS total_called,
    COUNT(CASE WHEN l.current_call_stage = 'Interested'        THEN 1 END)    AS interested,
    COUNT(CASE WHEN l.current_call_stage = 'Not Interested'    THEN 1 END)    AS not_interested
  FROM leads l
  WHERE l.college_id    = p_college_id
    AND l.is_active     = true
    AND l.assigned_to   IS NOT NULL
  GROUP BY l.assigned_to;
$$;
