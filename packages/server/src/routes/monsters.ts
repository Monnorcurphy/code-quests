import { Router } from 'express';
import Database from 'better-sqlite3';
import { z } from 'zod';
import { MonsterScopeSchema, CreateMonsterTypeSchema } from '@code-quests/shared';
import { listMonsterTypes } from '../services/monster-types';

type MonsterRow = {
  id: string;
  type_id: string;
  name: string;
  scope: string;
  project_id: string | null;
  first_seen_at: string;
  last_seen_at: string;
  encounters: number;
  defeats: number;
  escapes: number;
  calibrated_difficulty: number;
  notes: string;
};

type EncounterRow = {
  id: string;
  monster_id: string;
  quest_id: string;
  appeared_at: string;
  combat_log_json: string;
  outcome: string;
  loot_json: string;
  resolved_at: string | null;
};

type QuestEncounterRow = EncounterRow & {
  monster_type_id: string;
  monster_name: string;
  calibrated_difficulty: number;
  sprite_path: string;
};

function rowToMonster(row: MonsterRow) {
  return {
    id: row.id,
    typeId: row.type_id,
    name: row.name,
    scope: row.scope,
    projectId: row.project_id,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    encounters: row.encounters,
    defeats: row.defeats,
    escapes: row.escapes,
    calibratedDifficulty: row.calibrated_difficulty,
    notes: row.notes,
  };
}

function rowToEncounter(row: EncounterRow) {
  return {
    id: row.id,
    monsterId: row.monster_id,
    questId: row.quest_id,
    appearedAt: row.appeared_at,
    combatLog: JSON.parse(row.combat_log_json) as unknown[],
    outcome: row.outcome,
    loot: JSON.parse(row.loot_json) as unknown[],
    resolvedAt: row.resolved_at ?? null,
  };
}

function rowToQuestEncounter(row: QuestEncounterRow) {
  return {
    ...rowToEncounter(row),
    monsterTypeId: row.monster_type_id,
    monsterName: row.monster_name,
    difficulty: Math.max(1, Math.min(5, row.calibrated_difficulty)) as 1 | 2 | 3 | 4 | 5,
    spritePath: row.sprite_path,
  };
}

const ENCOUNTER_BY_MONSTER_SQL =
  'SELECT * FROM monster_encounters WHERE monster_id = ? ORDER BY appeared_at DESC';

const ENCOUNTER_BY_QUEST_SQL = `
  SELECT me.*, m.type_id AS monster_type_id, m.name AS monster_name,
         m.calibrated_difficulty, mt.sprite_path
  FROM monster_encounters me
  JOIN monsters m ON me.monster_id = m.id
  JOIN monster_types mt ON m.type_id = mt.id
  WHERE me.quest_id = ?
  ORDER BY me.appeared_at ASC
`.trim();

const MONSTER_FILTER_SQL = `
  SELECT * FROM monsters
  WHERE (? IS NULL OR scope = ?)
    AND (? IS NULL OR type_id = ?)
  ORDER BY first_seen_at DESC
`.trim();

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-');
}

export function createMonstersRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/monster-types', (_req, res) => {
    res.json(listMonsterTypes(db));
  });

  router.post('/monsters/types', (req, res) => {
    const parsed = CreateMonsterTypeSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
      return;
    }

    const { name, spritePath, defaultDifficulty, failureSignature } = parsed.data;
    const id = `user:${slugify(name)}`;

    const existing = db.prepare('SELECT id FROM monster_types WHERE id = ?').get(id);
    if (existing) {
      res.status(409).json({ error: 'A monster type with this name already exists', field: 'name' });
      return;
    }

    db.prepare(
      `INSERT INTO monster_types (id, name, sprite_path, default_difficulty, failure_signature, created_by)
       VALUES (?, ?, ?, ?, ?, 'user')`,
    ).run(id, name, spritePath, defaultDifficulty, failureSignature);

    const row = db
      .prepare(
        'SELECT id, name, sprite_path, default_difficulty, failure_signature, created_by FROM monster_types WHERE id = ?',
      )
      .get(id) as Record<string, unknown>;

    res.status(201).json({
      id: row['id'],
      name: row['name'],
      spritePath: row['sprite_path'],
      defaultDifficulty: row['default_difficulty'],
      failureSignature: row['failure_signature'],
      createdBy: row['created_by'],
    });
  });

  router.get('/monsters', (req, res) => {
    const scopeRaw = req.query.scope as string | undefined;
    const typeIdRaw = req.query.typeId as string | undefined;

    if (scopeRaw !== undefined) {
      const parsed = MonsterScopeSchema.safeParse(scopeRaw);
      if (!parsed.success) {
        res.status(400).json({ error: 'scope must be "project" or "guild"', field: 'scope' });
        return;
      }
    }

    const scope = scopeRaw ?? null;
    const typeId = typeIdRaw ?? null;
    const rows = db
      .prepare(MONSTER_FILTER_SQL)
      .all(scope, scope, typeId, typeId) as MonsterRow[];
    res.json(rows.map(rowToMonster));
  });

  router.get('/monsters/:id', (req, res) => {
    const row = db
      .prepare('SELECT * FROM monsters WHERE id = ?')
      .get(req.params.id) as MonsterRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Monster not found' });
      return;
    }
    res.json(rowToMonster(row));
  });

  router.get('/monsters/:id/encounters', (req, res) => {
    const exists = db.prepare('SELECT id FROM monsters WHERE id = ?').get(req.params.id);
    if (!exists) {
      res.status(404).json({ error: 'Monster not found' });
      return;
    }
    const rows = db.prepare(ENCOUNTER_BY_MONSTER_SQL).all(req.params.id) as EncounterRow[];
    res.json(rows.map(rowToEncounter));
  });

  router.get('/quests/:questId/encounters', (req, res) => {
    const rows = db
      .prepare(ENCOUNTER_BY_QUEST_SQL)
      .all(req.params.questId) as QuestEncounterRow[];
    res.json(rows.map(rowToQuestEncounter));
  });

  router.post('/monsters/:id/promote-nemesis', (req, res) => {
    const monster = db
      .prepare('SELECT * FROM monsters WHERE id = ?')
      .get(req.params.id) as MonsterRow | undefined;
    if (!monster) {
      res.status(404).json({ error: 'Monster not found' });
      return;
    }
    if (monster.scope === 'guild') {
      res.status(400).json({ error: 'Monster is already a guild nemesis', field: 'scope' });
      return;
    }

    const bodySchema = z.object({ name: z.string().min(1).max(120).optional() });
    const parsed = bodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(
      "UPDATE monsters SET scope = 'guild', project_id = NULL, name = COALESCE(?, name), last_seen_at = ? WHERE id = ?",
    ).run(parsed.data.name ?? null, now, req.params.id);

    const updated = db
      .prepare('SELECT * FROM monsters WHERE id = ?')
      .get(req.params.id) as MonsterRow;
    res.json(rowToMonster(updated));
  });

  return router;
}
