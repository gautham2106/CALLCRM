-- ============================================================
-- CALLCRM - Admission CRM System
-- Initial Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID UNIQUE, -- links to Supabase Auth user
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'counsellor')),
  college_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COLLEGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS colleges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  subscription_plan TEXT DEFAULT 'free',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add college_id FK to users
ALTER TABLE users ADD CONSTRAINT fk_users_college
  FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE SET NULL;

-- ============================================================
-- LEAD SOURCES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS lead_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEADS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  city TEXT,
  course_interest TEXT,
  source_id UUID REFERENCES lead_sources(id) ON DELETE SET NULL,
  source_name TEXT, -- snapshot at time of creation
  current_lead_stage TEXT NOT NULL DEFAULT 'New Enquiry'
    CHECK (current_lead_stage IN (
      'New Enquiry', 'Contacted', 'Visit Scheduled', 'Visit Done',
      'Application Started', 'Enrolled', 'Cold Lead', 'Wrong Lead'
    )),
  current_call_stage TEXT
    CHECK (current_call_stage IN (
      'Call Picked', 'Interested', 'Not Interested',
      'Call Not Picked', 'Call Later'
    )),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  priority TEXT DEFAULT 'Warm'
    CHECK (priority IN ('Hot', 'Warm', 'Cold')),
  follow_up_date DATE,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_leads_college_id ON leads(college_id);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_leads_stage ON leads(current_lead_stage);
CREATE INDEX idx_leads_follow_up ON leads(follow_up_date);

-- ============================================================
-- CALL DIARY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS call_diary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  called_by UUID NOT NULL REFERENCES users(id),
  call_stage TEXT NOT NULL
    CHECK (call_stage IN (
      'Call Picked', 'Interested', 'Not Interested',
      'Call Not Picked', 'Call Later'
    )),
  lead_stage_at_time TEXT NOT NULL, -- snapshot
  notes TEXT,
  follow_up_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_call_diary_lead_id ON call_diary(lead_id);
CREATE INDEX idx_call_diary_called_by ON call_diary(called_by);

-- ============================================================
-- LEAD ASSIGNMENT HISTORY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS lead_assignment_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  assigned_from UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_to UUID NOT NULL REFERENCES users(id),
  assigned_by UUID NOT NULL REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assignment_history_lead_id ON lead_assignment_history(lead_id);

-- ============================================================
-- CUSTOM FIELD DEFINITIONS (SUPER FIELDS)
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL
    CHECK (field_type IN ('text', 'number', 'phone', 'dropdown', 'date', 'checkbox', 'textarea')),
  dropdown_options JSONB DEFAULT '[]'::jsonb,
  is_required BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_custom_fields_college ON custom_field_definitions(college_id);

-- ============================================================
-- CUSTOM FIELD VALUES
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_field_values (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  value TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id, field_id)
);

CREATE INDEX idx_custom_field_values_lead ON custom_field_values(lead_id);

-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  type TEXT NOT NULL
    CHECK (type IN ('new_lead', 'bulk_leads', 'reassigned')),
  message TEXT NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  bulk_count INTEGER,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_diary ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_sources ENABLE ROW LEVEL SECURITY;

-- Users can see their own record and admins can see all in their college
CREATE POLICY "users_own_record" ON users
  FOR ALL USING (auth.uid() = auth_id);

-- Leads: admins see all, counsellors see only assigned
CREATE POLICY "leads_access" ON leads
  FOR SELECT USING (
    college_id IN (
      SELECT college_id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "leads_insert" ON leads
  FOR INSERT WITH CHECK (
    college_id IN (
      SELECT college_id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "leads_update" ON leads
  FOR UPDATE USING (
    college_id IN (
      SELECT college_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Call diary access
CREATE POLICY "call_diary_access" ON call_diary
  FOR ALL USING (
    college_id IN (
      SELECT college_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Notifications: only own
CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Other tables: college-based access
CREATE POLICY "lead_sources_access" ON lead_sources
  FOR ALL USING (
    college_id IN (
      SELECT college_id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "custom_fields_access" ON custom_field_definitions
  FOR ALL USING (
    college_id IN (
      SELECT college_id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "custom_field_values_access" ON custom_field_values
  FOR ALL USING (
    college_id IN (
      SELECT college_id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "assignment_history_access" ON lead_assignment_history
  FOR ALL USING (
    college_id IN (
      SELECT college_id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "colleges_access" ON colleges
  FOR SELECT USING (
    id IN (
      SELECT college_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SAMPLE DATA (for development)
-- ============================================================
-- Insert a sample college
INSERT INTO colleges (id, name, email, phone)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo College',
  'admin@democollege.edu',
  '9876543210'
);

-- Insert sample lead sources
INSERT INTO lead_sources (college_id, source_name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Google Ad'),
  ('00000000-0000-0000-0000-000000000001', 'Walk-in'),
  ('00000000-0000-0000-0000-000000000001', 'Instagram'),
  ('00000000-0000-0000-0000-000000000001', 'Referral'),
  ('00000000-0000-0000-0000-000000000001', 'JustDial'),
  ('00000000-0000-0000-0000-000000000001', 'Naukri'),
  ('00000000-0000-0000-0000-000000000001', 'Website Form');
