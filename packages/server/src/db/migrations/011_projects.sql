-- Projects: a registered working directory the user wants quests to run against.
-- A user might add their own repo, a todo-list directory, an open-source project
-- they're contributing to, etc. Quests are scoped to a project; the agent
-- subprocess uses project.path as its cwd.

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_projects_last_used_at ON projects(last_used_at DESC);

-- Nullable for the 18 legacy quests already in the DB. New quests must set it.
ALTER TABLE quests ADD COLUMN project_id TEXT REFERENCES projects(id);
CREATE INDEX IF NOT EXISTS idx_quests_project_id ON quests(project_id);
