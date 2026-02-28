-- Add school_name column to leads for school-based tracking and import mapping
ALTER TABLE leads ADD COLUMN IF NOT EXISTS school_name TEXT;

-- Composite index for school-based filtering and analytics
CREATE INDEX IF NOT EXISTS idx_leads_college_school
  ON leads(college_id, school_name);
