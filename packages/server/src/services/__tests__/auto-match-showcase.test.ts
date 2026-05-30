import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Adventurer, Quest, Agent, Monster, MonsterType } from '@code-quests/shared';
import { AdventurerSchema, QuestSchema } from '@code-quests/shared';
import { openDb } from '../../db/connection';
import { runMigrations } from '../../db/migrator';
import { seedShowcase } from '../../scripts/seed-showcase';
import { listMonsterTypes } from '../monster-types';
import { autoMatch } from '../auto-match';
import type Database from 'better-sqlite3';

function makeDb(): Database.Database {
  const db = openDb(':memory:');
  runMigrations(db);
  return db;
}

function loadAdventurers(db: Database.Database): Adventurer[] {
  const rows = db
    .prepare(`SELECT * FROM adventurers WHERE id LIKE 'adv-showcase-%' ORDER BY created_at, id`)
    .all() as Record<string, unknown>[];
  return rows.map((r) =>
    AdventurerSchema.parse({
      id: r['id'],
      name: r['name'],
      class: r['class'],
      modelId: r['model_id'],
      createdAt: r['created_at'],
      stats: JSON.parse(r['stats_json'] as string),
      specializations: JSON.parse(r['specializations_json'] as string),
      scars: JSON.parse(r['scars_json'] as string),
    }),
  );
}

function loadQuest(db: Database.Database, id: string): Quest {
  const r = db.prepare(`SELECT * FROM quests WHERE id = ?`).get(id) as Record<string, unknown>;
  return QuestSchema.parse({
    id: r['id'],
    epicId: r['epic_id'],
    title: r['title'],
    description: r['description'],
    acceptanceCriteria: JSON.parse(r['acceptance_criteria_json'] as string),
    edgeCases: JSON.parse(r['edge_cases_json'] as string),
    context: r['context'],
    status: r['status'],
    adventurerId: r['adventurer_id'],
    agentId: r['agent_id'],
    equipment: JSON.parse(r['equipment_json'] as string),
    specAudit: r['spec_audit_json'] ? JSON.parse(r['spec_audit_json'] as string) : null,
    failureSummary: r['failure_summary_json'] ? JSON.parse(r['failure_summary_json'] as string) : null,
    inputRequest: r['input_request_json'] ? JSON.parse(r['input_request_json'] as string) : null,
    userBlocker: r['user_blocker_json'] ? JSON.parse(r['user_blocker_json'] as string) : null,
    currentScene: r['current_scene'],
    createdAt: r['created_at'],
    updatedAt: r['updated_at'],
    acLockedAt: r['ac_locked_at'],
  });
}

function loadMonsters(db: Database.Database): Monster[] {
  const rows = db.prepare('SELECT id, type_id FROM monsters').all() as {
    id: string;
    type_id: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    typeId: r.type_id,
    name: '',
    scope: 'project' as const,
    projectId: null,
    modelId: null,
    firstSeenAt: '',
    lastSeenAt: '',
    encounters: 0,
    defeats: 0,
    escapes: 0,
    calibratedDifficulty: 1,
    notes: '',
  }));
}

function loadMonsterTypes(db: Database.Database): MonsterType[] {
  return listMonsterTypes(db).map((mt) => ({
    id: mt.id,
    name: mt.name,
    spritePath: mt.spritePath,
    defaultDifficulty: mt.defaultDifficulty,
    failureSignature: mt.failureSignature,
    createdBy: mt.createdBy as 'system' | 'user',
  }));
}

function makeAgent(adventurerId: string): Agent {
  return {
    id: `agent-${adventurerId}`,
    adventurerId,
    questId: 'quest-placeholder',
    startedAt: '2024-01-01T00:00:00.000Z',
    endedAt: null,
    pid: null,
    exitCode: null,
  };
}

describe('auto-match showcase — deterministic demo path', () => {
  let db: Database.Database;
  let guild: Adventurer[];
  let jwtQuest: Quest;
  let copyQuest: Quest;
  let meterQuest: Quest;
  let monsters: Monster[];
  let monsterTypes: MonsterType[];

  beforeEach(() => {
    db = makeDb();
    seedShowcase(db);
    guild = loadAdventurers(db);
    jwtQuest = loadQuest(db, 'quest-showcase-jwt');
    copyQuest = loadQuest(db, 'quest-showcase-copy');
    meterQuest = loadQuest(db, 'quest-showcase-meter');
    monsters = loadMonsters(db);
    monsterTypes = loadMonsterTypes(db);
  });

  afterEach(() => {
    db.close();
  });

  it('quest-showcase-jwt → adv-showcase-brielle (wins by net score: 8 wins, no scars)', () => {
    const match = autoMatch(jwtQuest, guild, [], { monsters, monsterTypes });
    expect(match?.id).toBe('adv-showcase-brielle');
  });

  it('quest-showcase-copy → adv-showcase-tess (Scout class match; Tess beats Rook by net wins)', () => {
    const activeAgents = [makeAgent('adv-showcase-brielle')];
    const match = autoMatch(copyQuest, guild, activeAgents, { monsters, monsterTypes });
    expect(match?.id).toBe('adv-showcase-tess');
  });

  it('quest-showcase-meter → adv-showcase-rook (only remaining Scout; Brielle and Tess busy)', () => {
    const activeAgents = [
      makeAgent('adv-showcase-brielle'),
      makeAgent('adv-showcase-tess'),
    ];
    const match = autoMatch(meterQuest, guild, activeAgents, { monsters, monsterTypes });
    expect(match?.id).toBe('adv-showcase-rook');
  });

  it('results are identical regardless of guild array order', () => {
    const shuffled = [...guild].reverse();

    expect(autoMatch(jwtQuest, guild, [], { monsters, monsterTypes })?.id).toBe(
      autoMatch(jwtQuest, shuffled, [], { monsters, monsterTypes })?.id,
    );

    const agentsAfterJwt = [makeAgent('adv-showcase-brielle')];
    expect(autoMatch(copyQuest, guild, agentsAfterJwt, { monsters, monsterTypes })?.id).toBe(
      autoMatch(copyQuest, shuffled, agentsAfterJwt, { monsters, monsterTypes })?.id,
    );

    const agentsAfterCopy = [
      makeAgent('adv-showcase-brielle'),
      makeAgent('adv-showcase-tess'),
    ];
    expect(autoMatch(meterQuest, guild, agentsAfterCopy, { monsters, monsterTypes })?.id).toBe(
      autoMatch(meterQuest, shuffled, agentsAfterCopy, { monsters, monsterTypes })?.id,
    );
  });
});
