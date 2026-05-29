-- Add CHECK(created_by IN ('system','user')) to monster_types.
-- SQLite cannot add CHECK constraints to existing tables; use the rebuild pattern.

PRAGMA foreign_keys = OFF;

CREATE TABLE monster_types_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sprite_path TEXT NOT NULL DEFAULT '',
  default_difficulty INTEGER NOT NULL DEFAULT 1,
  failure_signature TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT 'system'
    CHECK(created_by IN ('system', 'user'))
);

INSERT INTO monster_types_new SELECT id, name, sprite_path, default_difficulty, failure_signature, created_by FROM monster_types;

DROP TABLE monster_types;

ALTER TABLE monster_types_new RENAME TO monster_types;

PRAGMA foreign_keys = ON;
