import type Database from 'better-sqlite3';
import type { Model, ModelProvider, ModelConfig } from '@code-quests/shared';
import { ModelConfigSchema } from '@code-quests/shared';

type ModelRow = {
  id: string;
  name: string;
  provider: string;
  model_id: string;
  config_json: string;
  created_at: string;
  last_used_at: string | null;
};

function parseConfig(raw: string): ModelConfig {
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = ModelConfigSchema.safeParse(parsed);
    return result.success ? result.data : {};
  } catch {
    return {};
  }
}

function rowToModel(row: ModelRow): Model {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider as ModelProvider,
    modelId: row.model_id,
    config: parseConfig(row.config_json),
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

export function listModels(db: Database.Database): Model[] {
  const rows = db
    .prepare(
      `SELECT * FROM models
       ORDER BY COALESCE(last_used_at, created_at) DESC`,
    )
    .all() as ModelRow[];
  return rows.map(rowToModel);
}

export function getModel(db: Database.Database, id: string): Model | null {
  const row = db.prepare('SELECT * FROM models WHERE id = ?').get(id) as ModelRow | undefined;
  return row ? rowToModel(row) : null;
}

export function createModel(
  db: Database.Database,
  input: {
    id: string;
    name: string;
    provider: ModelProvider;
    modelId: string;
    config: ModelConfig;
  },
): Model {
  db.prepare(
    'INSERT INTO models (id, name, provider, model_id, config_json) VALUES (?, ?, ?, ?, ?)',
  ).run(input.id, input.name, input.provider, input.modelId, JSON.stringify(input.config));
  return getModel(db, input.id)!;
}

export function touchModel(db: Database.Database, id: string): void {
  db.prepare("UPDATE models SET last_used_at = datetime('now') WHERE id = ?").run(id);
}

export function deleteModel(db: Database.Database, id: string): boolean {
  const info = db.prepare('DELETE FROM models WHERE id = ?').run(id);
  return info.changes > 0;
}
