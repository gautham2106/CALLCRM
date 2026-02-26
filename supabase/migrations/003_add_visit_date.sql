-- Add visit_date column to leads table for tracking scheduled campus visit dates
ALTER TABLE leads ADD COLUMN IF NOT EXISTS visit_date DATE;
