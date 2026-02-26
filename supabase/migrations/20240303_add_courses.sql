-- Add courses table and course_id foreign key on leads

-- 1. Create courses table (mirrors lead_sources pattern)
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  course_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courses_college_id ON courses(college_id);

-- 2. Add course_id FK on leads (course_interest TEXT remains as a name snapshot)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_course_id ON leads(course_id);

-- 3. RLS
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- All users in the same college can read active courses (needed for counsellor dropdowns)
CREATE POLICY "College users can view courses" ON courses
  FOR SELECT USING (
    college_id = (
      SELECT college_id FROM users WHERE auth_id = auth.uid() LIMIT 1
    )
  );

-- Only admins of the same college can insert/update/delete
CREATE POLICY "Admins can manage courses" ON courses
  FOR ALL USING (
    college_id = (
      SELECT college_id FROM users WHERE auth_id = auth.uid() AND role = 'admin' LIMIT 1
    )
  )
  WITH CHECK (
    college_id = (
      SELECT college_id FROM users WHERE auth_id = auth.uid() AND role = 'admin' LIMIT 1
    )
  );
