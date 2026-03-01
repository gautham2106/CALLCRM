-- ============================================================
-- Extend get_counsellor_stats with:
--   no_show          – leads currently in "No Show" stage (need re-scheduling)
--   visits_overdue   – Visit Scheduled + visit_date < today (counsellor hasn't acted)
--   missed_followups – follow_up_date passed AND no call logged since that date
--
-- Both visits_overdue and missed_followups are the actionable "missed" alerts
-- that a team leader needs to track per counsellor.
-- ============================================================

-- Must drop first because return type (OUT columns) changed
DROP FUNCTION IF EXISTS get_counsellor_stats(uuid, date);

CREATE FUNCTION get_counsellor_stats(p_college_id UUID, p_today DATE)
RETURNS TABLE(
  assigned_to      UUID,
  assigned         BIGINT,
  called           BIGINT,
  interested       BIGINT,
  not_interested   BIGINT,
  enrolled         BIGINT,
  followups_today  BIGINT,
  visits_today     BIGINT,
  no_show          BIGINT,
  visits_overdue   BIGINT,
  missed_followups BIGINT
)
SECURITY DEFINER
LANGUAGE SQL STABLE AS $$
  SELECT
    l.assigned_to,
    COUNT(*)                                                                   AS assigned,
    COUNT(CASE WHEN l.current_call_stage IS NOT NULL        THEN 1 END)        AS called,
    COUNT(CASE WHEN l.current_call_stage = 'Interested'     THEN 1 END)        AS interested,
    COUNT(CASE WHEN l.current_call_stage = 'Not Interested' THEN 1 END)        AS not_interested,
    COUNT(CASE WHEN l.current_lead_stage = 'Enrolled'       THEN 1 END)        AS enrolled,
    COUNT(CASE WHEN l.follow_up_date     = p_today          THEN 1 END)        AS followups_today,
    COUNT(CASE WHEN l.visit_date         = p_today          THEN 1 END)        AS visits_today,

    -- No Show: counsellor already marked this stage — needs re-scheduling
    COUNT(CASE WHEN l.current_lead_stage = 'No Show'        THEN 1 END)        AS no_show,

    -- Visits overdue: visit_date passed but still "Visit Scheduled" — no action taken yet
    COUNT(CASE WHEN l.current_lead_stage = 'Visit Scheduled'
               AND  l.visit_date IS NOT NULL
               AND  l.visit_date < p_today                  THEN 1 END)        AS visits_overdue,

    -- Missed followup: follow_up_date passed AND no call was logged on/after that date
    COUNT(CASE WHEN l.follow_up_date IS NOT NULL
               AND  l.follow_up_date < p_today
               AND  l.current_lead_stage NOT IN ('Enrolled', 'Cold Lead', 'Wrong Lead', 'No Show')
               AND  NOT EXISTS (
                      SELECT 1 FROM call_diary cd
                      WHERE  cd.lead_id       = l.id
                        AND  cd.created_at::date >= l.follow_up_date
                    )                                        THEN 1 END)        AS missed_followups

  FROM   leads l
  WHERE  l.college_id  = p_college_id
    AND  l.is_active   = true
    AND  l.assigned_to IS NOT NULL
  GROUP  BY l.assigned_to;
$$;
