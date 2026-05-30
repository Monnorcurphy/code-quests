import type Database from 'better-sqlite3';
import type { Project } from '@code-quests/shared';

type ProjectRow = {
  id: string;
  name: string;
  path: string;
  created_at: string;
  last_used_at: string | null;
};

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

export function listProjects(db: Database.Database): Project[] {
  const rows = db
    .prepare(
      `SELECT * FROM projects
       ORDER BY COALESCE(last_used_at, created_at) DESC`,
    )
    .all() as ProjectRow[];
  return rows.map(rowToProject);
}

export function getProject(db: Database.Database, id: string): Project | null {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;
  return row ? rowToProject(row) : null;
}

export function getProjectByPath(db: Database.Database, path: string): Project | null {
  const row = db
    .prepare('SELECT * FROM projects WHERE path = ?')
    .get(path) as ProjectRow | undefined;
  return row ? rowToProject(row) : null;
}

export function createProject(
  db: Database.Database,
  input: { id: string; name: string; path: string },
): Project {
  db.prepare('INSERT INTO projects (id, name, path) VALUES (?, ?, ?)').run(
    input.id,
    input.name,
    input.path,
  );
  return getProject(db, input.id)!;
}

export function touchProject(db: Database.Database, id: string): void {
  db.prepare("UPDATE projects SET last_used_at = datetime('now') WHERE id = ?").run(id);
}

export function deleteProject(db: Database.Database, id: string): boolean {
  const info = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  return info.changes > 0;
}
