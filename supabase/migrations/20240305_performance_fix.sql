-- ============================================================
-- PERFORMANCE FIX: Composite Indexes + SQL Aggregate Functions
-- Replaces JavaScript aggregation with single DB queries.
-- Fixes browser crashes at 1L+ leads and slow dashboards.
-- ============================================================

-- ---- Composite Indexes ----
-- Single-column indexes already exist. These composite indexes cover
-- the most common query patterns (college_id + filter column) so the
-- planner can satisfy queries with one index scan instead of two.

CREATE INDEX IF NOT EXISTS idx_leads_college_stage
  ON leads(college_id, current_lead_stage);

CREATE INDEX IF NOT EXISTS idx_leads_college_counsellor
  ON leads(college_id, assigned_to);

CREATE INDEX IF NOT EXISTS idx_leads_college_source
  ON leads(college_id, source_name);

CREATE INDEX IF NOT EXISTS idx_leads_college_followup
  ON leads(college_id, follow_up_date);

CREATE INDEX IF NOT EXISTS idx_leads_college_updated
  ON leads(college_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_leads_college_created
  ON leads(college_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_diary_college_date
  ON call_diary(college_id, created_at);

-- ---- SQL Aggregate Functions ----
-- Each function replaces a full table fetch + JavaScript loop.
-- SECURITY DEFINER runs as the DB owner so it bypasses RLS
-- (safe here because the admin client already holds service-role key).

-- 1. Stage funnel: replaces stageData fetch + JS GROUP BY
CREATE OR REPLACE FUNCTION get_stage_counts(p_college_id UUID)
RETURNS TABLE(stage TEXT, cnt BIGINT)
SECURITY DEFINER
LANGUAGE SQL STABLE AS $$
  SELECT current_lead_stage AS stage, COUNT(*) AS cnt
  FROM   leads
  WHERE  college_id = p_college_id AND is_active = true
  GROUP  BY current_lead_stage;
$$;

-- 2. Counsellor stats: replaces assignedLeads fetch + JS join/count
CREATE OR REPLACE FUNCTION get_counsellor_stats(p_college_id UUID, p_today DATE)
RETURNS TABLE(
  assigned_to    UUID,
  assigned       BIGINT,
  called         BIGINT,
  interested     BIGINT,
  enrolled       BIGINT,
  followups_today BIGINT,
  visits_today   BIGINT
)
SECURITY DEFINER
LANGUAGE SQL STABLE AS $$
  SELECT
    assigned_to,
    COUNT(*)                                                          AS assigned,
    COUNT(CASE WHEN current_call_stage IS NOT NULL     THEN 1 END)   AS called,
    COUNT(CASE WHEN current_call_stage = 'Interested'  THEN 1 END)   AS interested,
    COUNT(CASE WHEN current_lead_stage = 'Enrolled'    THEN 1 END)   AS enrolled,
    COUNT(CASE WHEN follow_up_date     = p_today       THEN 1 END)   AS followups_today,
    COUNT(CASE WHEN visit_date         = p_today       THEN 1 END)   AS visits_today
  FROM   leads
  WHERE  college_id  = p_college_id
    AND  is_active   = true
    AND  assigned_to IS NOT NULL
  GROUP  BY assigned_to;
$$;

-- 3. Source totals + monthly trend: replaces sourceData full fetch
CREATE OR REPLACE FUNCTION get_source_stats(
  p_college_id UUID,
  p_this_month TEXT,
  p_last_month TEXT
)
RETURNS TABLE(
  source     TEXT,
  total      BIGINT,
  enrolled   BIGINT,
  this_month BIGINT,
  last_month BIGINT
)
SECURITY DEFINER
LANGUAGE SQL STABLE AS $$
  SELECT
    COALESCE(source_name, 'Unknown')                                                    AS source,
    COUNT(*)                                                                             AS total,
    COUNT(CASE WHEN current_lead_stage = 'Enrolled'                          THEN 1 END) AS enrolled,
    COUNT(CASE WHEN to_char(created_at, 'YYYY-MM') = p_this_month            THEN 1 END) AS this_month,
    COUNT(CASE WHEN to_char(created_at, 'YYYY-MM') = p_last_month            THEN 1 END) AS last_month
  FROM   leads
  WHERE  college_id = p_college_id AND is_active = true
  GROUP  BY COALESCE(source_name, 'Unknown');
$$;

-- 4. Per-source stage breakdown: replaces JS nested counting
CREATE OR REPLACE FUNCTION get_source_stage_breakdown(p_college_id UUID)
RETURNS TABLE(source TEXT, stage TEXT, cnt BIGINT)
SECURITY DEFINER
LANGUAGE SQL STABLE AS $$
  SELECT
    COALESCE(source_name, 'Unknown') AS source,
    current_lead_stage               AS stage,
    COUNT(*)                         AS cnt
  FROM   leads
  WHERE  college_id = p_college_id AND is_active = true
  GROUP  BY COALESCE(source_name, 'Unknown'), current_lead_stage;
$$;

-- 5. Recent leads per source (drill-down): replaces full lead list per source.
--    Limited to p_per_source rows per source (default 20) via window function.
CREATE OR REPLACE FUNCTION get_source_recent_leads(
  p_college_id UUID,
  p_per_source  INT DEFAULT 20
)
RETURNS TABLE(
  source     TEXT,
  id         UUID,
  name       TEXT,
  phone      TEXT,
  stage      TEXT,
  assigned_to UUID,
  created_at  TIMESTAMPTZ
)
SECURITY DEFINER
LANGUAGE SQL STABLE AS $$
  SELECT sub.source, sub.id, sub.name, sub.phone, sub.stage, sub.assigned_to, sub.created_at
  FROM (
    SELECT
      COALESCE(source_name, 'Unknown') AS source,
      id, name, phone,
      current_lead_stage               AS stage,
      assigned_to, created_at,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(source_name, 'Unknown')
        ORDER BY     created_at DESC
      ) AS rn
    FROM   leads
    WHERE  college_id = p_college_id AND is_active = true
  ) sub
  WHERE sub.rn <= p_per_source;
$$;
