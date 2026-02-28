-- Add not_interested to get_counsellor_stats
-- Must DROP first because return type changes (adding not_interested column)
DROP FUNCTION IF EXISTS get_counsellor_stats(uuid, date);

CREATE FUNCTION get_counsellor_stats(p_college_id UUID, p_today DATE)
RETURNS TABLE(
  assigned_to     UUID,
  assigned        BIGINT,
  called          BIGINT,
  interested      BIGINT,
  not_interested  BIGINT,
  enrolled        BIGINT,
  followups_today BIGINT,
  visits_today    BIGINT
)
SECURITY DEFINER
LANGUAGE SQL STABLE AS $$
  SELECT
    assigned_to,
    COUNT(*)                                                                AS assigned,
    COUNT(CASE WHEN current_call_stage IS NOT NULL          THEN 1 END)    AS called,
    COUNT(CASE WHEN current_call_stage = 'Interested'       THEN 1 END)    AS interested,
    COUNT(CASE WHEN current_call_stage = 'Not Interested'   THEN 1 END)    AS not_interested,
    COUNT(CASE WHEN current_lead_stage = 'Enrolled'         THEN 1 END)    AS enrolled,
    COUNT(CASE WHEN follow_up_date     = p_today            THEN 1 END)    AS followups_today,
    COUNT(CASE WHEN visit_date         = p_today            THEN 1 END)    AS visits_today
  FROM   leads
  WHERE  college_id  = p_college_id
    AND  is_active   = true
    AND  assigned_to IS NOT NULL
  GROUP  BY assigned_to;
$$;
