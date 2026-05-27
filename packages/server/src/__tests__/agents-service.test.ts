import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb } from '../db/connection';
import { runMigrations } from '../db/migrator';
import {
  createAgent,
  endAgent,
  findAgentByQuest,
  findActiveAgents,
} from '../services/agents-service';

function setupDb(): Database.Database {
  const db = openDb(':memory:');
  runMigrations(db);
  db.prepare('INSERT INTO adventurers (id, name, class, model_id) VALUES (?, ?, ?, ?)').run(
    'adv-1',
    'Aria',
    'ranger',
    'claude-opus-4-7',
  );
  db.prepare('INSERT INTO quests (id, title) VALUES (?, ?)').run('quest-1', 'Test Quest');
  return db;
}

describe('agents-service', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupDb();
  });

  afterEach(() => {
    db.close();
  });

  describe('createAgent', () => {
    it('inserts a row and parses through AgentSchema', () => {
      const agent = createAgent(db, { adventurerId: 'adv-1', questId: 'quest-1', pid: null });
      expect(agent.id).toBeTruthy();
      expect(agent.adventurerId).toBe('adv-1');
      expect(agent.questId).toBe('quest-1');
      expect(agent.startedAt).toBeTruthy();
      expect(agent.endedAt).toBeNull();
      expect(agent.pid).toBeNull();
      expect(agent.exitCode).toBeNull();
    });

    it('stores pid when provided', () => {
      const agent = createAgent(db, { adventurerId: 'adv-1', questId: 'quest-1', pid: 1234 });
      expect(agent.pid).toBe(1234);
    });

    it('throws FK violation when adventurerId is unknown', () => {
      expect(() =>
        createAgent(db, { adventurerId: 'nonexistent', questId: 'quest-1', pid: null }),
      ).toThrow();
    });

    it('throws FK violation when questId is unknown', () => {
      expect(() =>
        createAgent(db, { adventurerId: 'adv-1', questId: 'nonexistent', pid: null }),
      ).toThrow();
    });
  });

  describe('endAgent', () => {
    it('sets ended_at and exit_code', () => {
      const agent = createAgent(db, { adventurerId: 'adv-1', questId: 'quest-1', pid: null });
      const ended = endAgent(db, agent.id, 0);
      expect(ended.endedAt).toBeTruthy();
      expect(ended.exitCode).toBe(0);
    });

    it('stores null exit_code when agent was cancelled', () => {
      const agent = createAgent(db, { adventurerId: 'adv-1', questId: 'quest-1', pid: null });
      const ended = endAgent(db, agent.id, null);
      expect(ended.endedAt).toBeTruthy();
      expect(ended.exitCode).toBeNull();
    });
  });

  describe('findAgentByQuest', () => {
    it('returns the agent for a known quest', () => {
      createAgent(db, { adventurerId: 'adv-1', questId: 'quest-1', pid: null });
      const found = findAgentByQuest(db, 'quest-1');
      expect(found).not.toBeNull();
      expect(found!.questId).toBe('quest-1');
    });

    it('returns null for an unknown quest', () => {
      const found = findAgentByQuest(db, 'unknown-quest');
      expect(found).toBeNull();
    });
  });

  describe('findActiveAgents', () => {
    it('returns only agents without ended_at', () => {
      const a1 = createAgent(db, { adventurerId: 'adv-1', questId: 'quest-1', pid: null });
      endAgent(db, a1.id, 0);

      db.prepare('INSERT INTO adventurers (id, name, class, model_id) VALUES (?, ?, ?, ?)').run(
        'adv-2',
        'Bob',
        'scout',
        'claude-haiku-4-5-20251001',
      );
      db.prepare('INSERT INTO quests (id, title) VALUES (?, ?)').run('quest-2', 'Second Quest');
      createAgent(db, { adventurerId: 'adv-2', questId: 'quest-2', pid: null });

      const active = findActiveAgents(db);
      expect(active).toHaveLength(1);
      expect(active[0].questId).toBe('quest-2');
    });

    it('returns empty array when no active agents', () => {
      const a1 = createAgent(db, { adventurerId: 'adv-1', questId: 'quest-1', pid: null });
      endAgent(db, a1.id, 0);
      expect(findActiveAgents(db)).toHaveLength(0);
    });
  });
});
