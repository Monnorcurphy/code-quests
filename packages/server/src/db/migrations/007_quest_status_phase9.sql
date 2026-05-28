-- Phase 9: extend quest status to include returned_to_town and retired.
-- SQLite requires table recreation to modify a CHECK constraint.
PRAGMA foreign_keys = OFF;

BEGIN;

CREATE TABLE quests_new (
  id TEXT PRIMARY KEY,
  epic_id TEXT REFERENCES epics(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  acceptance_criteria_json TEXT NOT NULL DEFAULT '[]',
  edge_cases_json TEXT NOT NULL DEFAULT '[]',
  context TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'idle'
    CHECK(status IN ('idle','active','complete','failed','paused_input','user_blocked','returned_to_town','retired')),
  adventurer_id TEXT REFERENCES adventurers(id),
  agent_id TEXT,
  equipment_json TEXT NOT NULL DEFAULT '{}',
  spec_audit_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  ac_locked_at TEXT,
  input_request_json TEXT,
  user_blocker_json TEXT,
  failure_summary_json TEXT,
  user_feedback_json TEXT,
  current_scene TEXT NOT NULL DEFAULT 'quest-forest'
    CHECK(current_scene IN ('quest-forest','quest-cave','quest-dungeon','quest-boss-room'))
);

INSERT INTO quests_new (
  id, epic_id, title, description, acceptance_criteria_json, edge_cases_json, context, status,
  adventurer_id, agent_id, equipment_json, spec_audit_json, created_at, updated_at, ac_locked_at,
  input_request_json, user_blocker_json, failure_summary_json, user_feedback_json, current_scene
)
SELECT
  id, epic_id, title, description, acceptance_criteria_json, edge_cases_json, context, status,
  adventurer_id, agent_id, equipment_json, spec_audit_json, created_at, updated_at, ac_locked_at,
  input_request_json, user_blocker_json, failure_summary_json, user_feedback_json, current_scene
FROM quests;

DROP TABLE quests;

ALTER TABLE quests_new RENAME TO quests;

COMMIT;

PRAGMA foreign_keys = ON;
