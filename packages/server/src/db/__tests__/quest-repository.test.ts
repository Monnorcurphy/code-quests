import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb } from '../connection';
import { runMigrations } from '../migrator';
import {
  setInputRequest,
  clearInputRequest,
  setUserBlocker,
  getInputRequest,
  getUserBlocker,
} from '../quest-repository';

function insertAdventurer(db: Database.Database, id: string) {
  db.prepare('INSERT INTO adventurers (id, name, class, model_id) VALUES (?, ?, ?, ?)').run(
    id,
    `Hero ${id}`,
    'ranger',
    'claude-haiku',
  );
}

function insertQuest(db: Database.Database, id: string, advId: string) {
  db.prepare(
    'INSERT INTO quests (id, title, adventurer_id) VALUES (?, ?, ?)',
  ).run(id, 'Test Quest', advId);
}

describe('quest-repository', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    insertAdventurer(db, 'adv-1');
    insertQuest(db, 'q-1', 'adv-1');
  });

  afterEach(() => {
    db.close();
  });

  describe('setInputRequest / getInputRequest', () => {
    it('writes and reads an InputRequest roundtrip', () => {
      const request = {
        question: 'Should I use approach A or approach B?',
        context: 'We are at a fork in the road.',
        awaitingSince: '2026-01-01T00:00:00Z',
        adventureFraming: 'The hero pauses at the crossroads.',
      };

      setInputRequest(db, 'q-1', request);
      const result = getInputRequest(db, 'q-1');

      expect(result).toEqual(request);
    });

    it('returns null when no input request is set', () => {
      const result = getInputRequest(db, 'q-1');
      expect(result).toBeNull();
    });

    it('returns null for unknown quest', () => {
      const result = getInputRequest(db, 'no-such-quest');
      expect(result).toBeNull();
    });

    it('writes InputRequest without optional fields', () => {
      const request = {
        question: 'What is the plan?',
        awaitingSince: '2026-05-01T12:00:00Z',
      };

      setInputRequest(db, 'q-1', request);
      const result = getInputRequest(db, 'q-1');

      expect(result).not.toBeNull();
      expect(result!.question).toBe('What is the plan?');
      expect(result!.awaitingSince).toBe('2026-05-01T12:00:00Z');
      expect(result!.context).toBeUndefined();
      expect(result!.adventureFraming).toBeUndefined();
    });

    it('updates the updated_at timestamp when setting', () => {
      const before = (db.prepare('SELECT updated_at FROM quests WHERE id = ?').get('q-1') as { updated_at: string }).updated_at;

      setInputRequest(db, 'q-1', {
        question: 'Test?',
        awaitingSince: '2026-01-01T00:00:00Z',
      });

      const after = (db.prepare('SELECT updated_at FROM quests WHERE id = ?').get('q-1') as { updated_at: string }).updated_at;
      expect(after >= before).toBe(true);
    });
  });

  describe('clearInputRequest', () => {
    it('removes a previously set InputRequest', () => {
      setInputRequest(db, 'q-1', {
        question: 'Which path?',
        awaitingSince: '2026-01-01T00:00:00Z',
      });

      clearInputRequest(db, 'q-1');
      const result = getInputRequest(db, 'q-1');

      expect(result).toBeNull();
    });

    it('is a no-op when no input request exists', () => {
      expect(() => clearInputRequest(db, 'q-1')).not.toThrow();
      expect(getInputRequest(db, 'q-1')).toBeNull();
    });
  });

  describe('setUserBlocker / getUserBlocker', () => {
    it('writes and reads a UserBlocker roundtrip', () => {
      const blocker = {
        rawDescription: 'Waiting on design review from the team.',
        adventureFraming: 'The hero awaits word from the council.',
        markedAt: '2026-01-02T10:00:00Z',
        unblockedAt: '2026-01-02T15:00:00Z',
      };

      setUserBlocker(db, 'q-1', blocker);
      const result = getUserBlocker(db, 'q-1');

      expect(result).toEqual(blocker);
    });

    it('returns null when no user blocker is set', () => {
      const result = getUserBlocker(db, 'q-1');
      expect(result).toBeNull();
    });

    it('returns null for unknown quest', () => {
      const result = getUserBlocker(db, 'no-such-quest');
      expect(result).toBeNull();
    });

    it('clears user blocker when null is passed', () => {
      setUserBlocker(db, 'q-1', {
        rawDescription: 'Waiting on review.',
        markedAt: '2026-01-01T00:00:00Z',
      });

      setUserBlocker(db, 'q-1', null);
      const result = getUserBlocker(db, 'q-1');

      expect(result).toBeNull();
    });

    it('writes UserBlocker without optional fields', () => {
      const blocker = {
        rawDescription: 'Need a decision from management.',
        markedAt: '2026-03-01T08:00:00Z',
      };

      setUserBlocker(db, 'q-1', blocker);
      const result = getUserBlocker(db, 'q-1');

      expect(result).not.toBeNull();
      expect(result!.rawDescription).toBe('Need a decision from management.');
      expect(result!.markedAt).toBe('2026-03-01T08:00:00Z');
      expect(result!.adventureFraming).toBeUndefined();
      expect(result!.unblockedAt).toBeUndefined();
    });

    it('updates the updated_at timestamp when setting', () => {
      const before = (db.prepare('SELECT updated_at FROM quests WHERE id = ?').get('q-1') as { updated_at: string }).updated_at;

      setUserBlocker(db, 'q-1', {
        rawDescription: 'Blocked.',
        markedAt: '2026-01-01T00:00:00Z',
      });

      const after = (db.prepare('SELECT updated_at FROM quests WHERE id = ?').get('q-1') as { updated_at: string }).updated_at;
      expect(after >= before).toBe(true);
    });
  });
});
