import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb } from '../../db/connection';
import { runMigrations } from '../../db/migrator';
import { returnQuestToTown, QuestReturnError } from '../quest-return';
import type { AgentEvent } from '@code-quests/shared';

function setup() {
  const db = openDb(':memory:');
  runMigrations(db);
  return db;
}

function insertAdventurer(
  db: Database.Database,
  id: string,
  opts: { questsWon?: number; questsLost?: number } = {},
) {
  const stats = { questsWon: opts.questsWon ?? 0, questsLost: opts.questsLost ?? 0 };
  db.prepare(
    'INSERT INTO adventurers (id, name, class, model_id, stats_json) VALUES (?, ?, ?, ?, ?)',
  ).run(id, `Hero ${id}`, 'ranger', 'claude-haiku', JSON.stringify(stats));
}

function insertQuest(
  db: Database.Database,
  id: string,
  opts: {
    status?: string;
    adventurerId?: string | null;
  } = {},
) {
  db.prepare(
    `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json, status, adventurer_id, equipment_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    'Test Quest',
    'A description long enough to satisfy audit checks',
    JSON.stringify(['Criterion A']),
    JSON.stringify([]),
    opts.status ?? 'failed',
    opts.adventurerId ?? null,
    JSON.stringify({ skillIds: [], toolIds: [], mcpServerIds: [] }),
  );
}

function insertAgent(db: Database.Database, agentId: string, questId: string, adventurerId: string) {
  db.prepare(
    'INSERT INTO agents (id, adventurer_id, quest_id, events_json) VALUES (?, ?, ?, ?)',
  ).run(agentId, adventurerId, questId, '[]');
}

function insertMonsterType(db: Database.Database, id: string) {
  db.prepare(
    `INSERT OR IGNORE INTO monster_types (id, name, sprite_path, default_difficulty, failure_signature, created_by)
     VALUES (?, ?, ?, ?, ?, 'system')`,
  ).run(id, `Monster ${id}`, `monsters/${id}.png`, 3, 'test');
}

function insertMonster(db: Database.Database, id: string, typeId: string) {
  db.prepare(
    `INSERT INTO monsters (id, type_id, name, scope, first_seen_at, last_seen_at, calibrated_difficulty)
     VALUES (?, ?, ?, 'project', datetime('now'), datetime('now'), 3)`,
  ).run(id, typeId, `Named ${id}`);
}

function insertEncounter(
  db: Database.Database,
  id: string,
  opts: {
    questId: string;
    monsterId: string;
    outcome: 'victory' | 'defeat' | 'escape';
    appearedAt?: string;
  },
) {
  db.prepare(
    `INSERT INTO monster_encounters (id, monster_id, quest_id, appeared_at, combat_log_json, outcome, loot_json)
     VALUES (?, ?, ?, ?, '[]', ?, '[]')`,
  ).run(
    id,
    opts.monsterId,
    opts.questId,
    opts.appearedAt ?? new Date().toISOString(),
    opts.outcome,
  );
}

describe('returnQuestToTown', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setup();
    insertMonsterType(db, 'ogre_failing_test');
    insertMonsterType(db, 'hydra_ac_mismatch');
  });

  afterEach(() => {
    db.close();
  });

  it('throws QuestReturnError when quest does not exist', () => {
    expect(() => returnQuestToTown('nonexistent', db)).toThrow(QuestReturnError);
  });

  it('flips status from failed to returned_to_town', () => {
    insertAdventurer(db, 'adv-1', { questsWon: 3 });
    insertQuest(db, 'q-1', { status: 'failed', adventurerId: 'adv-1' });

    returnQuestToTown('q-1', db);

    const row = db.prepare('SELECT status FROM quests WHERE id = ?').get('q-1') as { status: string };
    expect(row.status).toBe('returned_to_town');
  });

  it('throws QuestReturnError when quest is not in failed state', () => {
    insertAdventurer(db, 'adv-1');
    insertQuest(db, 'q-1', { status: 'active', adventurerId: 'adv-1' });

    expect(() => returnQuestToTown('q-1', db)).toThrow(QuestReturnError);
  });

  it('populates failure_summary_json with the synthesized summary', () => {
    insertAdventurer(db, 'adv-1', { questsWon: 5 });
    insertQuest(db, 'q-1', { status: 'failed', adventurerId: 'adv-1' });
    insertAgent(db, 'ag-1', 'q-1', 'adv-1');
    insertMonster(db, 'monster-1', 'ogre_failing_test');
    insertEncounter(db, 'enc-1', { questId: 'q-1', monsterId: 'monster-1', outcome: 'defeat' });

    returnQuestToTown('q-1', db);

    const row = db.prepare('SELECT failure_summary_json FROM quests WHERE id = ?').get('q-1') as {
      failure_summary_json: string;
    };
    const summary = JSON.parse(row.failure_summary_json) as {
      fatalEncounterId: string;
      retries: number;
      recommendation: string;
      notes: string;
    };
    expect(summary.fatalEncounterId).toBe('enc-1');
    expect(summary.retries).toBe(1);
    expect(summary.recommendation).toBe('repost_with_clarification');
    expect(summary.notes.length).toBeGreaterThan(0);
  });

  describe('scar minting', () => {
    it('does NOT add a scar when recommendation is repost_with_clarification', () => {
      insertAdventurer(db, 'adv-1', { questsWon: 5 });
      insertQuest(db, 'q-1', { status: 'failed', adventurerId: 'adv-1' });
      insertAgent(db, 'ag-1', 'q-1', 'adv-1');
      insertMonster(db, 'monster-1', 'ogre_failing_test');
      insertEncounter(db, 'enc-1', { questId: 'q-1', monsterId: 'monster-1', outcome: 'defeat' });

      returnQuestToTown('q-1', db);

      const row = db.prepare('SELECT scars_json FROM adventurers WHERE id = ?').get('adv-1') as {
        scars_json: string;
      };
      expect(JSON.parse(row.scars_json)).toHaveLength(0);
    });

    it('adds a scar when recommendation warrants it and lifetime quests >= 3', () => {
      insertAdventurer(db, 'adv-1', { questsWon: 5 });
      // Provide completed quest history so lifetimeQuestCount >= 3
      insertQuest(db, 'q-past-1', { status: 'complete', adventurerId: 'adv-1' });
      insertQuest(db, 'q-past-2', { status: 'complete', adventurerId: 'adv-1' });
      insertQuest(db, 'q-1', { status: 'failed', adventurerId: 'adv-1' });
      insertAgent(db, 'ag-1', 'q-1', 'adv-1');
      insertAgent(db, 'ag-2', 'q-1', 'adv-1');
      insertMonster(db, 'monster-1', 'ogre_failing_test');
      insertEncounter(db, 'enc-1', { questId: 'q-1', monsterId: 'monster-1', outcome: 'defeat' });

      returnQuestToTown('q-1', db);

      const row = db.prepare('SELECT scars_json FROM adventurers WHERE id = ?').get('adv-1') as {
        scars_json: string;
      };
      const scars = JSON.parse(row.scars_json) as Array<{ questId: string; monsterIdAtFatal: string }>;
      expect(scars).toHaveLength(1);
      expect(scars[0].questId).toBe('q-1');
      expect(scars[0].monsterIdAtFatal).toBe('monster-1');
    });

    it('does NOT add a scar for an apprentice adventurer with < 3 lifetime quests', () => {
      insertAdventurer(db, 'adv-1', { questsWon: 2, questsLost: 0 });
      insertQuest(db, 'q-1', { status: 'failed', adventurerId: 'adv-1' });
      insertAgent(db, 'ag-1', 'q-1', 'adv-1');
      insertAgent(db, 'ag-2', 'q-1', 'adv-1');
      insertMonster(db, 'monster-1', 'ogre_failing_test');
      insertEncounter(db, 'enc-1', { questId: 'q-1', monsterId: 'monster-1', outcome: 'defeat' });

      returnQuestToTown('q-1', db);

      const row = db.prepare('SELECT scars_json FROM adventurers WHERE id = ?').get('adv-1') as {
        scars_json: string;
      };
      expect(JSON.parse(row.scars_json)).toHaveLength(0);
    });
  });

  describe('atomicity', () => {
    it('rolls back all writes when the status transition fails', () => {
      insertAdventurer(db, 'adv-1', { questsWon: 5 });
      insertQuest(db, 'q-1', { status: 'active', adventurerId: 'adv-1' });
      insertAgent(db, 'ag-1', 'q-1', 'adv-1');
      insertMonster(db, 'monster-1', 'ogre_failing_test');
      insertEncounter(db, 'enc-1', { questId: 'q-1', monsterId: 'monster-1', outcome: 'defeat' });

      expect(() => returnQuestToTown('q-1', db)).toThrow(QuestReturnError);

      const questRow = db.prepare('SELECT status, failure_summary_json FROM quests WHERE id = ?').get('q-1') as {
        status: string;
        failure_summary_json: string | null;
      };
      expect(questRow.status).toBe('active');
      expect(questRow.failure_summary_json).toBeNull();

      const advRow = db.prepare('SELECT scars_json FROM adventurers WHERE id = ?').get('adv-1') as {
        scars_json: string;
      };
      expect(JSON.parse(advRow.scars_json)).toHaveLength(0);
    });
  });

  describe('WebSocket event', () => {
    it('emits quest_returned event with correct payload', () => {
      insertAdventurer(db, 'adv-1', { questsWon: 5 });
      insertQuest(db, 'q-1', { status: 'failed', adventurerId: 'adv-1' });
      insertAgent(db, 'ag-1', 'q-1', 'adv-1');
      insertMonster(db, 'monster-1', 'ogre_failing_test');
      insertEncounter(db, 'enc-1', { questId: 'q-1', monsterId: 'monster-1', outcome: 'defeat' });

      const emitted: AgentEvent[] = [];
      const channel = {
        publishQuestEvent: (_questId: string, event: AgentEvent) => {
          emitted.push(event);
        },
      };

      returnQuestToTown('q-1', db, channel);

      expect(emitted).toHaveLength(1);
      const event = emitted[0];
      expect(event.type).toBe('quest_returned');
      if (event.type === 'quest_returned') {
        expect(event.questId).toBe('q-1');
        expect(typeof event.scarAdded).toBe('boolean');
        expect(event.failureSummary.recommendation).toBeTruthy();
      }
    });

    it('does not emit when no channel is provided', () => {
      insertAdventurer(db, 'adv-1');
      insertQuest(db, 'q-1', { status: 'failed', adventurerId: 'adv-1' });

      expect(() => returnQuestToTown('q-1', db)).not.toThrow();
    });
  });

  describe('no adventurer', () => {
    it('works for quests with no assigned adventurer (no scar)', () => {
      insertQuest(db, 'q-orphan', { status: 'failed', adventurerId: null });

      returnQuestToTown('q-orphan', db);

      const row = db.prepare('SELECT status FROM quests WHERE id = ?').get('q-orphan') as { status: string };
      expect(row.status).toBe('returned_to_town');
    });
  });

  describe('PRAGMA foreign_keys', () => {
    it('enforces foreign key constraints', () => {
      expect(() => {
        db.prepare(
          `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json, adventurer_id, equipment_json)
           VALUES ('q-bad', 'X', 'X', '[]', '[]', 'nonexistent-adv', '{}')`,
        ).run();
      }).toThrow();
    });
  });

  describe('showcase seed scenario', () => {
    it('appends a scar to Brielle when the JWT quest fails with a retire recommendation', () => {
      // Seed Brielle (8 wins qualifies her for scars; scars list starts empty)
      const brielleStats = JSON.stringify({ questsWon: 8, questsLost: 0 });
      db.prepare(
        `INSERT OR IGNORE INTO adventurers (id, name, class, model_id, stats_json, specializations_json, scars_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run('adv-showcase-brielle', 'Brielle the Bold', 'champion', 'claude-opus-4-7', brielleStats, '[]', '[]');

      insertMonsterType(db, 'imp_typecheck');
      insertMonster(db, 'imp-jwt-01', 'imp_typecheck');

      // Add 2 completed quests so lifetimeQuestCount >= 3 (bypasses scar grace period)
      for (let i = 1; i <= 2; i++) {
        db.prepare(
          `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json,
            status, adventurer_id, equipment_json)
           VALUES (?, ?, ?, '[]', '[]', 'complete', ?, '{}')`,
        ).run(`quest-brielle-prior-${i}`, `Prior Quest ${i}`, 'Prior quest', 'adv-showcase-brielle');
      }

      // Insert 2 prior agents to simulate a 2nd attempt → recommendation = 'retire' (not repost_with_clarification)
      db.prepare(
        `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json,
          status, adventurer_id, equipment_json)
         VALUES (?, ?, ?, ?, ?, 'failed', ?, ?)`,
      ).run(
        'quest-showcase-jwt-scar-test',
        'Migrate to JWT',
        'A description long enough to satisfy audit checks',
        JSON.stringify(['AC1', 'AC2']),
        JSON.stringify([]),
        'adv-showcase-brielle',
        JSON.stringify({ skillIds: [], toolIds: [], mcpServerIds: [] }),
      );
      insertAgent(db, 'ag-prior', 'quest-showcase-jwt-scar-test', 'adv-showcase-brielle');
      insertAgent(db, 'ag-current', 'quest-showcase-jwt-scar-test', 'adv-showcase-brielle');
      insertEncounter(db, 'enc-jwt-1', { questId: 'quest-showcase-jwt-scar-test', monsterId: 'imp-jwt-01', outcome: 'defeat' });

      returnQuestToTown('quest-showcase-jwt-scar-test', db);

      const row = db.prepare('SELECT scars_json FROM adventurers WHERE id = ?').get('adv-showcase-brielle') as {
        scars_json: string;
      };
      const scars = JSON.parse(row.scars_json) as Array<{
        questId: string;
        failureSummary: string;
        monsterIdAtFatal: string;
        occurredAt: string;
      }>;

      expect(scars).toHaveLength(1);
      expect(scars[0].questId).toBe('quest-showcase-jwt-scar-test');
      expect(typeof scars[0].failureSummary).toBe('string');
      expect(scars[0].failureSummary.length).toBeGreaterThan(0);
      expect(scars[0].monsterIdAtFatal).toBe('imp-jwt-01');
      expect(scars[0].occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
