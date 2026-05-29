import type Database from 'better-sqlite3';

export const MONSTER_PROJECT_ID = 'local';

export const BUILTIN_MONSTER_TYPE_IDS = [
  'goblin_linter',
  'imp_typecheck',
  'wraith_flaky_test',
  'ogre_failing_test',
  'hydra_ac_mismatch',
  'mimic_silent_failure',
  'wizard_env_or_dep',
  'troll_build_fail',
  'lich_repeated_failure',
  'dragon_epic_obstacle',
] as const;

export type BuiltinMonsterTypeId = (typeof BUILTIN_MONSTER_TYPE_IDS)[number];

export interface MonsterType {
  id: string;
  name: string;
  spritePath: string;
  defaultDifficulty: number;
  failureSignature: string;
  createdBy: string;
}

function rowToMonsterType(row: Record<string, unknown>): MonsterType {
  return {
    id: row['id'] as string,
    name: row['name'] as string,
    spritePath: row['sprite_path'] as string,
    defaultDifficulty: row['default_difficulty'] as number,
    failureSignature: row['failure_signature'] as string,
    createdBy: row['created_by'] as string,
  };
}

export function getMonsterType(db: Database.Database, id: string): MonsterType | undefined {
  const row = db
    .prepare('SELECT id, name, sprite_path, default_difficulty, failure_signature, created_by FROM monster_types WHERE id = ?')
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToMonsterType(row) : undefined;
}

export function listMonsterTypes(db: Database.Database): MonsterType[] {
  const rows = db
    .prepare(
      `SELECT id, name, sprite_path, default_difficulty, failure_signature, created_by
       FROM monster_types
       ORDER BY CASE created_by WHEN 'user' THEN 0 ELSE 1 END ASC,
                default_difficulty ASC,
                id ASC`,
    )
    .all() as Record<string, unknown>[];
  return rows.map(rowToMonsterType);
}

export function validateFailureSignature(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}
