-- ============================================================
-- Add source_id to get_source_stats RPC
-- Fixes Source Intelligence "View all leads" link:
-- Previously the RPC grouped by source_name snapshot only, making
-- it impossible to reliably map back to a lead_sources.id for
-- deep-linking to the filtered leads page.
-- Now groups by (source_id, display_name) and returns source_id
-- directly — no fragile name-to-id lookup needed.
-- ============================================================

DROP FUNCTION IF EXISTS get_source_stats(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_source_stats(
  p_college_id UUID,
  p_this_month TEXT,
  p_last_month TEXT
)
RETURNS TABLE(
  source     TEXT,
  source_id  UUID,
  total      BIGINT,
  enrolled   BIGINT,
  this_month BIGINT,
  last_month BIGINT
)
SECURITY DEFINER
LANGUAGE SQL STABLE AS $$
  SELECT
    COALESCE(ls.source_name, l.source_name, 'Unknown') AS source,
    l.source_id                                          AS source_id,
    COUNT(*)                                             AS total,
    COUNT(CASE WHEN l.current_lead_stage = 'Enrolled'                            THEN 1 END) AS enrolled,
    COUNT(CASE WHEN to_char(l.created_at, 'YYYY-MM') = p_this_month              THEN 1 END) AS this_month,
    COUNT(CASE WHEN to_char(l.created_at, 'YYYY-MM') = p_last_month              THEN 1 END) AS last_month
  FROM   leads l
  LEFT   JOIN lead_sources ls ON ls.id = l.source_id AND ls.college_id = p_college_id
  WHERE  l.college_id = p_college_id AND l.is_active = true
  GROUP  BY COALESCE(ls.source_name, l.source_name, 'Unknown'), l.source_id;
$$;
