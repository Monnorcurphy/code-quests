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

  // Phase 4 capstone demo quest — fully specified so dispatch works without manual setup
  const capstoneTitle = 'Phase 4 Demo: Notify users on quest completion';
  const existingCapstone = db.prepare('SELECT id FROM quests WHERE title = ?').get(capstoneTitle);
  if (!existingCapstone) {
    const capstoneId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO quests (id, epic_id, title, description, acceptance_criteria_json,
        edge_cases_json, context, status, equipment_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      capstoneId,
      epicId,
      capstoneTitle,
      'Add a real-time notification system that alerts users when their quests complete or fail. Use the existing WebSocket infrastructure to push events from the server and display toast notifications in the client UI.',
      JSON.stringify([
        'Notification appears within 2 seconds of quest status change',
        'Notifications are dismissible by the user',
        'Notifications respect prefers-reduced-motion',
      ]),
      JSON.stringify([
        'User has browser notifications disabled',
        'Multiple quests complete simultaneously',
      ]),
      'Uses the WebSocket channel from Phase 4. See quest-channel.ts and quest-socket.ts.',
      'idle',
      JSON.stringify({ skillIds: [], toolIds: [], mcpServerIds: [] }),
      now,
      now,
    );
    process.stdout.write(`Created capstone quest: ${capstoneTitle} (${capstoneId})\n`);
  }

  // Pre-completed quest so Hall of Returns is non-empty on first launch
  const completedTitle = 'Banish the Memory Leak';
  const existingCompleted = db.prepare('SELECT id FROM quests WHERE title = ?').get(completedTitle);
  if (!existingCompleted) {
    const adventurer = db
      .prepare("SELECT id FROM adventurers WHERE name = 'Brielle the Bold'")
      .get() as { id: string } | undefined;
    if (adventurer) {
      const completedQuestId = crypto.randomUUID();
      const agentId = crypto.randomUUID();
      const startedAt = new Date(Date.now() - 35 * 60 * 1000).toISOString();
      const endedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const events = [
        { type: 'progress', timestamp: startedAt, message: 'Setting out from town' },
        {
          type: 'combat',
          timestamp: new Date(new Date(startedAt).getTime() + 2 * 60 * 1000).toISOString(),
          monsterTypeId: 'imp_typecheck',
          message: 'Battling the Memory Imp',
        },
        {
          type: 'progress',
          timestamp: new Date(new Date(startedAt).getTime() + 4 * 60 * 1000).toISOString(),
          message: 'Returning home victorious',
        },
        { type: 'completed', timestamp: endedAt, summary: 'Memory leak identified and patched.' },
      ];

      db.prepare(
        `INSERT INTO quests (id, epic_id, title, description, acceptance_criteria_json,
          edge_cases_json, context, status, adventurer_id, agent_id, equipment_json,
          created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        completedQuestId,
        epicId,
        completedTitle,
        'Find and fix the memory leak causing the server to exhaust heap after 24 hours of uptime.',
        JSON.stringify([
          'Memory usage stays below 500 MB after 24h sustained load',
          'No OOM crash in 48h stress test',
        ]),
        JSON.stringify(['GC pressure from high-frequency WebSocket events']),
        'Located using node --inspect and heap snapshots targeting the event listener chain.',
        'complete',
        adventurer.id,
        agentId,
        JSON.stringify({ skillIds: [], toolIds: [], mcpServerIds: [] }),
        startedAt,
        endedAt,
      );

      db.prepare(
        `INSERT INTO agents (id, adventurer_id, quest_id, started_at, ended_at, pid, exit_code, events_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(agentId, adventurer.id, completedQuestId, startedAt, endedAt, null, 0, JSON.stringify(events));

      process.stdout.write(`Created completed quest: ${completedTitle} (${completedQuestId})\n`);
    }
  }

  process.stdout.write('Seed complete.\n');
}

seed();
