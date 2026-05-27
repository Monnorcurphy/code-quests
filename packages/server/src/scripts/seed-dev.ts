import { openDb } from '../db/connection';
import { runMigrations } from '../db/migrator';

function seed() {
  const db = openDb();
  runMigrations(db);

  const now = new Date().toISOString();

  // Epic
  const existingEpic = db.prepare("SELECT id FROM epics WHERE title = 'Phase 1 Demo'").get();
  let epicId: string;
  if (existingEpic) {
    epicId = (existingEpic as { id: string }).id;
  } else {
    epicId = crypto.randomUUID();
    db.prepare('INSERT INTO epics (id, title, goal, created_at) VALUES (?, ?, ?, ?)').run(
      epicId,
      'Phase 1 Demo',
      'Demonstrate all Phase 1 features end-to-end',
      now,
    );
    process.stdout.write(`Created epic: Phase 1 Demo (${epicId})\n`);
  }

  // Adventurer
  const existingAdventurer = db
    .prepare("SELECT id FROM adventurers WHERE name = 'Brielle the Bold'")
    .get();
  if (!existingAdventurer) {
    const adventurerId = crypto.randomUUID();
    db.prepare(
      'INSERT INTO adventurers (id, name, class, model_id, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(adventurerId, 'Brielle the Bold', 'champion', 'default', now);
    process.stdout.write(`Created adventurer: Brielle the Bold (${adventurerId})\n`);
  }

  // Quests
  const questSeeds = [
    {
      title: 'Implement dark mode toggle',
      description: 'Add a dark/light mode toggle to the UI settings panel.',
      acs: ['Toggle switches theme immediately', 'Preference persists across reloads'],
      edgeCases: ['User has system dark mode already enabled'],
      context: '',
    },
    {
      title: 'Add pagination to quest board',
      description: 'Show 10 quests per page with next/prev controls.',
      acs: ['Next/prev buttons appear when > 10 quests', 'URL reflects current page'],
      edgeCases: [],
      context: '',
    },
    {
      title: 'Improve search result ranking',
      description: 'Update the ranking algorithm to surface more relevant results.',
      acs: [],
      edgeCases: [],
      context: '',
    },
  ];

  for (const seed of questSeeds) {
    const existing = db.prepare('SELECT id FROM quests WHERE title = ?').get(seed.title);
    if (!existing) {
      const questId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO quests (id, epic_id, title, description, acceptance_criteria_json,
          edge_cases_json, context, status, equipment_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        questId,
        epicId,
        seed.title,
        seed.description,
        JSON.stringify(seed.acs),
        JSON.stringify(seed.edgeCases),
        seed.context,
        'idle',
        JSON.stringify({ skillIds: [], toolIds: [], mcpServerIds: [] }),
        now,
        now,
      );
      process.stdout.write(`Created quest: ${seed.title} (${questId})\n`);
    }
  }

  process.stdout.write('Seed complete.\n');
}

seed();
