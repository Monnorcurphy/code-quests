-- Phase 10: add auto-detection columns to skills for the self-improvement loop.
ALTER TABLE skills ADD COLUMN detected_for_adventurer_id TEXT REFERENCES adventurers(id);
ALTER TABLE skills ADD COLUMN last_detection_at TEXT;

-- Speed up candidate status lookups
CREATE INDEX IF NOT EXISTS idx_skills_status_typeids ON skills (status);
