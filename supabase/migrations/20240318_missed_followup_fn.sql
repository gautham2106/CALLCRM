-- ============================================================
-- Missed follow-up detection
-- A follow-up is "missed" when:
--   - follow_up_date has passed (< today IST)
--   - no call was logged in call_diary ON OR AFTER the follow_up_date
-- This is stricter than just checking the date — it confirms the
-- counsellor actually didn't call, rather than just not rescheduling.
-- ============================================================

CREATE OR REPLACE FUNCTION get_missed_followup_ids(
  p_college_id     UUID,
  p_counsellor_ids UUID[] DEFAULT NULL
)
RETURNS TABLE(id UUID)
SECURITY DEFINER
LANGUAGE SQL STABLE AS $$
  SELECT l.id
  FROM leads l
  WHERE l.college_id = p_college_id
    AND l.follow_up_date IS NOT NULL
    AND l.follow_up_date < (NOW() AT TIME ZONE 'Asia/Kolkata')::date
    AND l.current_lead_stage NOT IN ('Enrolled', 'Cold Lead', 'Wrong Lead', 'No Show')
    AND (l.is_active IS NULL OR l.is_active = true)
    AND (p_counsellor_ids IS NULL OR l.assigned_to = ANY(p_counsellor_ids))
    AND NOT EXISTS (
      SELECT 1 FROM call_diary cd
      WHERE cd.lead_id = l.id
        AND cd.created_at::date >= l.follow_up_date
    );
$$;
