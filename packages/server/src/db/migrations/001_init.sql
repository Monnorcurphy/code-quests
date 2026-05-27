-- Phase 1 tables

CREATE TABLE IF NOT EXISTS adventurers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  class TEXT NOT NULL
    CHECK(class IN ('champion', 'ranger', 'scout', 'rogue', 'apprentice')),
  model_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  stats_json TEXT NOT NULL DEFAULT '{}',
  specializations_json TEXT NOT NULL DEFAULT '[]',
  scars_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS epics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  goal TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quests (
  id TEXT PRIMARY KEY,
  epic_id TEXT REFERENCES epics(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  acceptance_criteria_json TEXT NOT NULL DEFAULT '[]',
  edge_cases_json TEXT NOT NULL DEFAULT '[]',
  context TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'idle'
    CHECK(status IN ('idle', 'active', 'complete', 'failed', 'paused_input', 'user_blocked')),
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
  user_feedback_json TEXT
);

-- Reserved tables (schema only — no API in Phase 1)

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  adventurer_id TEXT NOT NULL REFERENCES adventurers(id),
  quest_id TEXT NOT NULL REFERENCES quests(id),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  pid INTEGER,
  exit_code INTEGER
);

CREATE TABLE IF NOT EXISTS monster_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sprite_path TEXT NOT NULL DEFAULT '',
  default_difficulty INTEGER NOT NULL DEFAULT 1,
  failure_signature TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT 'system'
);

CREATE TABLE IF NOT EXISTS monsters (
  id TEXT PRIMARY KEY,
  type_id TEXT NOT NULL REFERENCES monster_types(id),
  name TEXT NOT NULL,
  scope TEXT NOT NULL CHECK(scope IN ('project', 'guild')),
  project_id TEXT,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  encounters INTEGER NOT NULL DEFAULT 0,
  defeats INTEGER NOT NULL DEFAULT 0,
  escapes INTEGER NOT NULL DEFAULT 0,
  calibrated_difficulty INTEGER NOT NULL DEFAULT 1,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS monster_encounters (
  id TEXT PRIMARY KEY,
  monster_id TEXT NOT NULL REFERENCES monsters(id),
  quest_id TEXT NOT NULL REFERENCES quests(id),
  appeared_at TEXT NOT NULL DEFAULT (datetime('now')),
  combat_log_json TEXT NOT NULL DEFAULT '[]',
  outcome TEXT NOT NULL DEFAULT 'escape'
    CHECK(outcome IN ('victory', 'defeat', 'escape')),
  loot_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  monster_type_ids_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'candidate'
    CHECK(status IN ('candidate', 'active', 'retired')),
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  hit_count INTEGER NOT NULL DEFAULT 0,
  implementation TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  invocation TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}'
);
