import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb } from '../connection';
import { runMigrations } from '../migrator';

function makeDb(): Database.Database {
  const db = openDb(':memory:');
  runMigrations(db);
  return db;
}

describe('FK pragma', () => {
  it('is ON after openDb', () => {
    const db = openDb(':memory:');
    const result = db.pragma('foreign_keys', { simple: true });
    expect(result).toBe(1);
    db.close();
  });

  it('throws on FK violation', () => {
    const db = makeDb();
    expect(() => {
      db.prepare(
        `INSERT INTO quests (id, title, epic_id) VALUES ('q1', 'Test', 'nonexistent-epic')`,
      ).run();
    }).toThrow();
    db.close();
  });
});

describe('migrator idempotency', () => {
  it('runs migrations twice without error', () => {
    const db = openDb(':memory:');
    runMigrations(db);
    expect(() => runMigrations(db)).not.toThrow();
    db.close();
  });
});

describe('reserved tables exist', () => {
  it('creates all expected tables', () => {
    const db = makeDb();
    const tables = (
      db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
        .all() as { name: string }[]
    ).map((r) => r.name);

    const expected = [
      'adventurers',
      'agents',
      'epics',
      'mcp_servers',
      'monster_encounters',
      'monster_types',
      'monsters',
      'quests',
      'schema_migrations',
      'skills',
      'tools',
    ];
    for (const table of expected) {
      expect(tables).toContain(table);
    }
    db.close();
  });
});

describe('adventurers CRUD', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  afterEach(() => {
    db.close();
  });

  it('inserts and reads an adventurer', () => {
    db.prepare(
      `INSERT INTO adventurers (id, name, class, model_id) VALUES (?, ?, ?, ?)`,
    ).run('adv-1', 'Aria', 'ranger', 'claude-opus-4-7');

    const row = db.prepare(`SELECT * FROM adventurers WHERE id = ?`).get('adv-1') as {
      id: string;
      name: string;
      class: string;
      model_id: string;
    };
    expect(row.name).toBe('Aria');
    expect(row.class).toBe('ranger');
    expect(row.model_id).toBe('claude-opus-4-7');
  });

  it('updates an adventurer', () => {
    db.prepare(
      `INSERT INTO adventurers (id, name, class, model_id) VALUES (?, ?, ?, ?)`,
    ).run('adv-2', 'Bram', 'wizard', 'claude-sonnet-4-6');

    db.prepare(`UPDATE adventurers SET name = ? WHERE id = ?`).run('Bramwell', 'adv-2');

    const row = db.prepare(`SELECT name FROM adventurers WHERE id = ?`).get('adv-2') as {
      name: string;
    };
    expect(row.name).toBe('Bramwell');
  });

  it('deletes an adventurer', () => {
    db.prepare(
      `INSERT INTO adventurers (id, name, class, model_id) VALUES (?, ?, ?, ?)`,
    ).run('adv-3', 'Cora', 'rogue', 'claude-haiku-4-5');

    db.prepare(`DELETE FROM adventurers WHERE id = ?`).run('adv-3');

    const row = db.prepare(`SELECT * FROM adventurers WHERE id = ?`).get('adv-3');
    expect(row).toBeUndefined();
  });
});

describe('epics CRUD', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  afterEach(() => {
    db.close();
  });

  it('inserts and reads an epic', () => {
    db.prepare(`INSERT INTO epics (id, title, goal) VALUES (?, ?, ?)`).run(
      'epic-1',
      'Conquer the Dark Tower',
      'Defeat the Lich King',
    );

    const row = db.prepare(`SELECT * FROM epics WHERE id = ?`).get('epic-1') as {
      id: string;
      title: string;
      goal: string;
    };
    expect(row.title).toBe('Conquer the Dark Tower');
    expect(row.goal).toBe('Defeat the Lich King');
  });

  it('updates an epic', () => {
    db.prepare(`INSERT INTO epics (id, title, goal) VALUES (?, ?, ?)`).run(
      'epic-2',
      'Old Title',
      'Old Goal',
    );
    db.prepare(`UPDATE epics SET title = ? WHERE id = ?`).run('New Title', 'epic-2');

    const row = db.prepare(`SELECT title FROM epics WHERE id = ?`).get('epic-2') as {
      title: string;
    };
    expect(row.title).toBe('New Title');
  });

  it('deletes an epic', () => {
    db.prepare(`INSERT INTO epics (id, title, goal) VALUES (?, ?, ?)`).run(
      'epic-3',
      'Doomed Epic',
      'Goal',
    );
    db.prepare(`DELETE FROM epics WHERE id = ?`).run('epic-3');

    const row = db.prepare(`SELECT * FROM epics WHERE id = ?`).get('epic-3');
    expect(row).toBeUndefined();
  });
});

describe('quests CRUD', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
    db.prepare(
      `INSERT INTO adventurers (id, name, class, model_id) VALUES (?, ?, ?, ?)`,
    ).run('adv-q', 'Hero', 'paladin', 'claude-opus-4-7');
    db.prepare(`INSERT INTO epics (id, title, goal) VALUES (?, ?, ?)`).run(
      'epic-q',
      'Epic',
      'Goal',
    );
  });

  afterEach(() => {
    db.close();
  });

  it('inserts and reads a quest', () => {
    db.prepare(
      `INSERT INTO quests (id, title, epic_id, adventurer_id) VALUES (?, ?, ?, ?)`,
    ).run('quest-1', 'Slay the Dragon', 'epic-q', 'adv-q');

    const row = db.prepare(`SELECT * FROM quests WHERE id = ?`).get('quest-1') as {
      id: string;
      title: string;
      status: string;
      epic_id: string;
    };
    expect(row.title).toBe('Slay the Dragon');
    expect(row.status).toBe('idle');
    expect(row.epic_id).toBe('epic-q');
  });

  it('updates quest status', () => {
    db.prepare(`INSERT INTO quests (id, title) VALUES (?, ?)`).run('quest-2', 'Find the Grail');
    db.prepare(`UPDATE quests SET status = ? WHERE id = ?`).run('active', 'quest-2');

    const row = db.prepare(`SELECT status FROM quests WHERE id = ?`).get('quest-2') as {
      status: string;
    };
    expect(row.status).toBe('active');
  });

  it('rejects invalid quest status', () => {
    db.prepare(`INSERT INTO quests (id, title) VALUES (?, ?)`).run('quest-3', 'Guard the Gate');
    expect(() => {
      db.prepare(`UPDATE quests SET status = ? WHERE id = ?`).run('invalid_status', 'quest-3');
    }).toThrow();
  });

  it('deletes a quest', () => {
    db.prepare(`INSERT INTO quests (id, title) VALUES (?, ?)`).run('quest-4', 'Doomed Quest');
    db.prepare(`DELETE FROM quests WHERE id = ?`).run('quest-4');

    const row = db.prepare(`SELECT * FROM quests WHERE id = ?`).get('quest-4');
    expect(row).toBeUndefined();
  });

  it('allows null epic_id (standalone quest)', () => {
    expect(() => {
      db.prepare(`INSERT INTO quests (id, title) VALUES (?, ?)`).run('quest-5', 'Solo Quest');
    }).not.toThrow();

    const row = db.prepare(`SELECT epic_id FROM quests WHERE id = ?`).get('quest-5') as {
      epic_id: string | null;
    };
    expect(row.epic_id).toBeNull();
  });

  it('rejects quest with non-existent epic_id FK', () => {
    expect(() => {
      db.prepare(`INSERT INTO quests (id, title, epic_id) VALUES (?, ?, ?)`).run(
        'quest-6',
        'Bad Quest',
        'ghost-epic',
      );
    }).toThrow();
  });
});
