import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { QuestSceneKeySchema } from '@code-quests/shared';
import { openDb } from '../../db/connection';
import { runMigrations } from '../../db/migrator';
import {
  nextScene,
  advanceQuestScene,
  getCurrentScene,
  QUEST_SCENE_ORDER,
} from '../quest-scene-progression';

function insertAdventurer(db: Database.Database, id: string) {
  db.prepare('INSERT INTO adventurers (id, name, class, model_id) VALUES (?, ?, ?, ?)').run(
    id,
    `Hero ${id}`,
    'ranger',
    'claude-haiku',
  );
}

function insertQuest(db: Database.Database, id: string, advId: string, currentScene = 'quest-forest') {
  db.prepare(
    'INSERT INTO quests (id, title, adventurer_id, current_scene) VALUES (?, ?, ?, ?)',
  ).run(id, 'Test Quest', advId, currentScene);
}

describe('nextScene', () => {
  it('returns correct progression through scenes', () => {
    expect(nextScene('quest-forest')).toBe('quest-cave');
    expect(nextScene('quest-cave')).toBe('quest-dungeon');
    expect(nextScene('quest-dungeon')).toBe('quest-boss-room');
  });

  it('returns null for boss-room (terminal scene)', () => {
    expect(nextScene('quest-boss-room')).toBeNull();
  });
});

describe('QUEST_SCENE_ORDER cross-boundary parity', () => {
  it('matches QuestSceneKeySchema options exactly (byte-for-byte)', () => {
    expect(QUEST_SCENE_ORDER).toEqual([...QuestSceneKeySchema.options]);
  });
});

describe('advanceQuestScene', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    insertAdventurer(db, 'adv-1');
  });

  afterEach(() => {
    db.close();
  });

  it('advances quest from forest to cave', () => {
    insertQuest(db, 'q-1', 'adv-1', 'quest-forest');

    const result = advanceQuestScene(db, 'q-1');

    expect(result).toEqual({ from: 'quest-forest', to: 'quest-cave' });
    const row = db.prepare('SELECT current_scene FROM quests WHERE id = ?').get('q-1') as {
      current_scene: string;
    };
    expect(row.current_scene).toBe('quest-cave');
  });

  it('advances through full progression', () => {
    insertQuest(db, 'q-full', 'adv-1', 'quest-forest');

    const t1 = advanceQuestScene(db, 'q-full');
    expect(t1).toEqual({ from: 'quest-forest', to: 'quest-cave' });

    const t2 = advanceQuestScene(db, 'q-full');
    expect(t2).toEqual({ from: 'quest-cave', to: 'quest-dungeon' });

    const t3 = advanceQuestScene(db, 'q-full');
    expect(t3).toEqual({ from: 'quest-dungeon', to: 'quest-boss-room' });
  });

  it('returns null at boss-room (terminal scene)', () => {
    insertQuest(db, 'q-boss', 'adv-1', 'quest-boss-room');

    const result = advanceQuestScene(db, 'q-boss');

    expect(result).toBeNull();
    const row = db.prepare('SELECT current_scene FROM quests WHERE id = ?').get('q-boss') as {
      current_scene: string;
    };
    expect(row.current_scene).toBe('quest-boss-room');
  });

  it('returns null for unknown quest', () => {
    const result = advanceQuestScene(db, 'no-such-quest');
    expect(result).toBeNull();
  });

  it('is idempotent under concurrent calls (no double-advance)', () => {
    insertQuest(db, 'q-concurrent', 'adv-1', 'quest-forest');

    const first = advanceQuestScene(db, 'q-concurrent');
    expect(first).toEqual({ from: 'quest-forest', to: 'quest-cave' });

    // Second call: current_scene is now cave, WHERE clause for forest won't match
    const second = advanceQuestScene(db, 'q-concurrent');
    // Second call sees cave, advances cave→dungeon (not a double-advance of forest→cave)
    expect(second).toEqual({ from: 'quest-cave', to: 'quest-dungeon' });

    const row = db.prepare('SELECT current_scene FROM quests WHERE id = ?').get('q-concurrent') as {
      current_scene: string;
    };
    expect(row.current_scene).toBe('quest-dungeon');
  });
});

describe('getCurrentScene', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    insertAdventurer(db, 'adv-1');
  });

  afterEach(() => {
    db.close();
  });

  it('returns the persisted current scene', () => {
    insertQuest(db, 'q-1', 'adv-1', 'quest-cave');

    const scene = getCurrentScene(db, 'q-1');

    expect(scene).toBe('quest-cave');
  });

  it('throws for unknown quest', () => {
    expect(() => getCurrentScene(db, 'no-such-quest')).toThrow();
  });

  it('reflects DB state after advance', () => {
    insertQuest(db, 'q-adv', 'adv-1', 'quest-forest');
    advanceQuestScene(db, 'q-adv');

    expect(getCurrentScene(db, 'q-adv')).toBe('quest-cave');
  });
});

describe('DB CHECK constraint enforcement', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    insertAdventurer(db, 'adv-check');
  });

  afterEach(() => {
    db.close();
  });

  it('rejects invalid current_scene values', () => {
    expect(() => {
      db.prepare('INSERT INTO quests (id, title, adventurer_id, current_scene) VALUES (?, ?, ?, ?)').run(
        'q-invalid',
        'Test',
        'adv-check',
        'invalid-scene',
      );
    }).toThrow();
  });

  it('accepts all valid current_scene values', () => {
    for (const scene of QUEST_SCENE_ORDER) {
      expect(() => {
        db.prepare('INSERT INTO quests (id, title, adventurer_id, current_scene) VALUES (?, ?, ?, ?)').run(
          `q-${scene}`,
          'Test',
          'adv-check',
          scene,
        );
      }).not.toThrow();
    }
  });
});
