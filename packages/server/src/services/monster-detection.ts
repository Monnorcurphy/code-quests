import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import { getMonsterType, listMonsterTypes, MONSTER_PROJECT_ID } from './monster-types';
import type { MonsterType } from './monster-types';
import { generateMonsterName } from './monster-name-generator';

export interface Monster {
  id: string;
  typeId: string;
  name: string;
  scope: 'project' | 'guild';
  projectId: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  encounters: number;
  defeats: number;
  escapes: number;
  calibratedDifficulty: number;
  notes: string;
}

export interface MonsterEncounter {
  id: string;
  monsterId: string;
  questId: string;
  appearedAt: string;
  combatLogJson: string;
  outcome: 'victory' | 'defeat' | 'escape';
  lootJson: string;
  resolvedAt: string | null;
}

export interface CombatEvent {
  type: 'combat';
  timestamp: string;
  monsterTypeId?: string;
  message: string;
}

export interface RecordEncounterOpts {
  questId: string;
  monsterTypeId: string;
  combatLogEntry: string;
  projectId?: string;
}

function rowToMonster(row: Record<string, unknown>): Monster {
  return {
    id: row['id'] as string,
    typeId: row['type_id'] as string,
    name: row['name'] as string,
    scope: row['scope'] as 'project' | 'guild',
    projectId: (row['project_id'] as string | null) ?? null,
    firstSeenAt: row['first_seen_at'] as string,
    lastSeenAt: row['last_seen_at'] as string,
    encounters: row['encounters'] as number,
    defeats: row['defeats'] as number,
    escapes: row['escapes'] as number,
    calibratedDifficulty: row['calibrated_difficulty'] as number,
    notes: row['notes'] as string,
  };
}

function rowToEncounter(row: Record<string, unknown>): MonsterEncounter {
  return {
    id: row['id'] as string,
    monsterId: row['monster_id'] as string,
    questId: row['quest_id'] as string,
    appearedAt: row['appeared_at'] as string,
    combatLogJson: row['combat_log_json'] as string,
    outcome: row['outcome'] as 'victory' | 'defeat' | 'escape',
    lootJson: row['loot_json'] as string,
    resolvedAt: (row['resolved_at'] as string | null | undefined) ?? null,
  };
}

export function classifyCombatEvent(
  db: Database.Database,
  event: CombatEvent,
): MonsterType | null {
  if (event.monsterTypeId) {
    const mt = getMonsterType(db, event.monsterTypeId);
    if (mt) return mt;
    process.stderr.write(
      `[monster-detection] unknown monsterTypeId '${event.monsterTypeId}', falling back to regex\n`,
    );
  }

  const types = listMonsterTypes(db);
  for (const t of types) {
    if (!t.failureSignature) continue;
    try {
      const re = new RegExp(t.failureSignature, 'i');
      if (re.test(event.message)) return t;
    } catch {
      // invalid regex in DB — skip silently
    }
  }

  process.stderr.write(
    `[monster-detection] no monster type matched message: "${event.message.slice(0, 80)}"\n`,
  );
  return null;
}

export function recordEncounter(
  db: Database.Database,
  opts: RecordEncounterOpts,
): { monster: Monster; encounter: MonsterEncounter } {
  const { questId, monsterTypeId, combatLogEntry, projectId = MONSTER_PROJECT_ID } = opts;
  const now = new Date().toISOString();

  let monsterRow = db
    .prepare(
      "SELECT * FROM monsters WHERE type_id = ? AND scope = 'project' AND project_id = ? LIMIT 1",
    )
    .get(monsterTypeId, projectId) as Record<string, unknown> | undefined;

  if (!monsterRow) {
    const mt = getMonsterType(db, monsterTypeId);
    const typeName = mt?.name ?? monsterTypeId;
    const monsterName = generateMonsterName(typeName);
    const monsterId = randomUUID();
    const initialDifficulty = mt?.defaultDifficulty ?? 1;
    db.prepare(
      `INSERT INTO monsters
         (id, type_id, name, scope, project_id, first_seen_at, last_seen_at,
          encounters, defeats, escapes, calibrated_difficulty, notes)
       VALUES (?, ?, ?, 'project', ?, ?, ?, 0, 0, 0, ?, '')`,
    ).run(monsterId, monsterTypeId, monsterName, projectId, now, now, initialDifficulty);
    monsterRow = db.prepare('SELECT * FROM monsters WHERE id = ?').get(monsterId) as Record<string, unknown>;
  }

  const monsterId = monsterRow['id'] as string;

  db.prepare(
    'UPDATE monsters SET encounters = encounters + 1, last_seen_at = ? WHERE id = ?',
  ).run(now, monsterId);

  const encounterId = randomUUID();
  const combatLog = JSON.stringify([combatLogEntry]);
  db.prepare(
    `INSERT INTO monster_encounters
       (id, monster_id, quest_id, appeared_at, combat_log_json, outcome, loot_json)
     VALUES (?, ?, ?, ?, ?, 'escape', '[]')`,
  ).run(encounterId, monsterId, questId, now, combatLog);

  const encounterRow = db
    .prepare('SELECT * FROM monster_encounters WHERE id = ?')
    .get(encounterId) as Record<string, unknown>;
  const updatedMonsterRow = db
    .prepare('SELECT * FROM monsters WHERE id = ?')
    .get(monsterId) as Record<string, unknown>;

  return {
    monster: rowToMonster(updatedMonsterRow),
    encounter: rowToEncounter(encounterRow),
  };
}

export function resolveEncounter(
  db: Database.Database,
  encounterId: string,
  outcome: 'victory' | 'defeat' | 'escape',
  extraLogEntries?: string[],
): MonsterEncounter {
  const encounterRow = db
    .prepare('SELECT * FROM monster_encounters WHERE id = ?')
    .get(encounterId) as Record<string, unknown> | undefined;

  if (!encounterRow) {
    throw new Error(`Monster encounter '${encounterId}' not found`);
  }

  if (extraLogEntries && extraLogEntries.length > 0) {
    const existing = JSON.parse(encounterRow['combat_log_json'] as string) as string[];
    const updated = JSON.stringify([...existing, ...extraLogEntries]);
    db.prepare('UPDATE monster_encounters SET combat_log_json = ? WHERE id = ?').run(
      updated,
      encounterId,
    );
  }

  const resolvedAt = new Date().toISOString();
  db.prepare('UPDATE monster_encounters SET outcome = ?, resolved_at = ? WHERE id = ?').run(
    outcome,
    resolvedAt,
    encounterId,
  );

  const monsterId = encounterRow['monster_id'] as string;
  if (outcome === 'victory') {
    db.prepare('UPDATE monsters SET defeats = defeats + 1 WHERE id = ?').run(monsterId);
  } else {
    db.prepare('UPDATE monsters SET escapes = escapes + 1 WHERE id = ?').run(monsterId);
  }

  recalibrateDifficulty(db, monsterId);

  const updated = db
    .prepare('SELECT * FROM monster_encounters WHERE id = ?')
    .get(encounterId) as Record<string, unknown>;

  return rowToEncounter(updated);
}

export function recalibrateDifficulty(db: Database.Database, monsterId: string): void {
  const monsterRow = db
    .prepare('SELECT encounters, defeats, type_id FROM monsters WHERE id = ?')
    .get(monsterId) as { encounters: number; defeats: number; type_id: string } | undefined;

  if (!monsterRow || monsterRow.encounters === 0) return;

  const mtRow = db
    .prepare('SELECT default_difficulty FROM monster_types WHERE id = ?')
    .get(monsterRow.type_id) as { default_difficulty: number } | undefined;

  const defaultDifficulty = mtRow?.default_difficulty ?? 1;
  const ratio = monsterRow.defeats / monsterRow.encounters;

  let calibrated: number;
  if (ratio >= 0.8) {
    calibrated = defaultDifficulty - 1;
  } else if (ratio <= 0.3) {
    calibrated = defaultDifficulty + 1;
  } else {
    calibrated = defaultDifficulty;
  }

  calibrated = Math.max(1, Math.min(5, calibrated));
  db.prepare('UPDATE monsters SET calibrated_difficulty = ? WHERE id = ?').run(
    calibrated,
    monsterId,
  );
}
