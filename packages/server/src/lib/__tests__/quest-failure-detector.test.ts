import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb } from '../../db/connection';
import { runMigrations } from '../../db/migrator';
import { detectAndHandleFailure } from '../quest-failure-detector';

function insertAdventurer(db: Database.Database, id: string): void {
  db.prepare(
    `INSERT INTO adventurers (id, name, class, model_id) VALUES (?, ?, ?, ?)`,
  ).run(id, `Hero ${id}`, 'ranger', 'claude-haiku');
}

function insertQuest(db: Database.Database, id: string, advId: string, status: string): void {
  db.prepare(
    `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json,
      status, adventurer_id, equipment_json, failure_summary_json)
     VALUES (?, ?, ?, '[]', '[]', ?, ?, '{}', ?)`,
  ).run(
    id,
    `Quest ${id}`,
    'A test quest',
    status,
    advId,
    JSON.stringify({ fatalEncounterId: '', retries: 1, recommendation: 'retire', notes: 'Test failure.' }),
  );
}

function insertAgent(db: Database.Database, questId: string, advId: string): string {
  const agentId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO agents (id, adventurer_id, quest_id, started_at, ended_at, exit_code, events_json)
     VALUES (?, ?, ?, datetime('now', '-1 minute'), datetime('now'), ?, '[]')`,
  ).run(agentId, advId, questId, 1);
  return agentId;
}

describe('detectAndHandleFailure', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    db.pragma('foreign_keys = ON');
  });

  it('transitions a failed quest to returned_to_town', () => {
    const advId = crypto.randomUUID();
    const questId = crypto.randomUUID();

    insertAdventurer(db, advId);
    insertQuest(db, questId, advId, 'failed');
    insertAgent(db, questId, advId);

    detectAndHandleFailure(questId, db);

    const row = db
      .prepare('SELECT status FROM quests WHERE id = ?')
      .get(questId) as { status: string };

    expect(row.status).toBe('returned_to_town');
  });

  it('does nothing when the quest is not in failed status', () => {
    const advId = crypto.randomUUID();
    const questId = crypto.randomUUID();

    insertAdventurer(db, advId);
    insertQuest(db, questId, advId, 'complete');

    detectAndHandleFailure(questId, db);

    const row = db
      .prepare('SELECT status FROM quests WHERE id = ?')
      .get(questId) as { status: string };

    expect(row.status).toBe('complete');
  });

  it('does nothing for an active quest', () => {
    const advId = crypto.randomUUID();
    const questId = crypto.randomUUID();

    insertAdventurer(db, advId);
    insertQuest(db, questId, advId, 'active');

    detectAndHandleFailure(questId, db);

    const row = db
      .prepare('SELECT status FROM quests WHERE id = ?')
      .get(questId) as { status: string };

    expect(row.status).toBe('active');
  });

  it('does nothing for an unknown questId', () => {
    expect(() => detectAndHandleFailure('nonexistent-id', db)).not.toThrow();
  });

  it('emits a quest_returned WebSocket event when transitioning', () => {
    const advId = crypto.randomUUID();
    const questId = crypto.randomUUID();

    insertAdventurer(db, advId);
    insertQuest(db, questId, advId, 'failed');
    insertAgent(db, questId, advId);

    const published: Array<{ questId: string; type: string }> = [];
    const channel = {
      publishQuestEvent: (qId: string, event: { type: string }) => {
        published.push({ questId: qId, type: event.type });
      },
    };

    detectAndHandleFailure(questId, db, channel);

    expect(published).toHaveLength(1);
    expect(published[0].type).toBe('quest_returned');
    expect(published[0].questId).toBe(questId);
  });

  it('simulates non-zero exit: runner marks quest failed, detector returns it to town', () => {
    const advId = crypto.randomUUID();
    const questId = crypto.randomUUID();

    insertAdventurer(db, advId);

    // Simulate quest-runner setting status to 'failed' after non-zero exit
    db.prepare(
      `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json,
        status, adventurer_id, equipment_json, failure_summary_json)
       VALUES (?, ?, ?, '[]', '[]', 'failed', ?, '{}', ?)`,
    ).run(
      questId,
      'Simulated non-zero exit quest',
      'Quest that simulates agent exit code 1',
      advId,
      JSON.stringify({ fatalEncounterId: '', retries: 1, recommendation: 'repost_with_clarification', notes: 'Agent exited with code 1.' }),
    );
    insertAgent(db, questId, advId);

    detectAndHandleFailure(questId, db);

    const row = db
      .prepare('SELECT status FROM quests WHERE id = ?')
      .get(questId) as { status: string };

    expect(row.status).toBe('returned_to_town');
  });
});
