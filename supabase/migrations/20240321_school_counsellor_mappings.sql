-- Persistent school → counsellor assignment rules per college.
-- When a lead CSV is imported with a school_name column, these mappings
-- are used to auto-assign leads without requiring manual step each time.
CREATE TABLE school_counsellor_mappings (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id   UUID        NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  school_name  TEXT        NOT NULL,
  counsellor_id UUID       REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(college_id, school_name)
);

CREATE INDEX idx_school_mappings_college ON school_counsellor_mappings(college_id);
