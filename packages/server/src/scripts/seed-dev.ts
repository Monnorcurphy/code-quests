import { openDb } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { evaluateSkillCandidate } from '../services/skill-candidate-detection';

function seed() {
  if (process.env.NODE_ENV === 'production') {
    process.stderr.write('seed-dev.ts must not run in production\n');
    process.exit(1);
  }

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

  // Phase 5 demo quest — active quest mid-expedition in quest-cave for capstone E2E demo
  const phase5Title = 'Phase 5 Demo: Cave Expedition';
  const adventurer = db
    .prepare("SELECT id FROM adventurers WHERE name = 'Brielle the Bold'")
    .get() as { id: string } | undefined;

  if (adventurer) {
    const existingPhase5 = db
      .prepare('SELECT id FROM quests WHERE title = ?')
      .get(phase5Title) as { id: string } | undefined;

    let activeQuestId: string;
    if (existingPhase5) {
      activeQuestId = existingPhase5.id;
      db.prepare(
        "UPDATE quests SET status = 'active', current_scene = 'quest-cave', adventurer_id = ?, updated_at = ? WHERE id = ?",
      ).run(adventurer.id, now, activeQuestId);
      // End any lingering active agents before creating a fresh one
      db.prepare(
        "UPDATE agents SET ended_at = ?, exit_code = 0 WHERE quest_id = ? AND ended_at IS NULL",
      ).run(now, activeQuestId);
      process.stdout.write(`Reset Phase 5 demo quest to cave scene: ${phase5Title}\n`);
    } else {
      activeQuestId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO quests (id, epic_id, title, description, acceptance_criteria_json,
          edge_cases_json, context, status, adventurer_id, equipment_json, current_scene,
          created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        activeQuestId,
        epicId,
        phase5Title,
        'A Phase 5 demonstration quest mid-expedition through the Cave of Null Pointers.',
        JSON.stringify(['Navigate all four quest scenes', 'Return to town safely']),
        JSON.stringify(['Encounter a null pointer at the cave entrance']),
        'Phase 5 capstone demo. Current scene: quest-cave.',
        'active',
        adventurer.id,
        JSON.stringify({ skillIds: [], toolIds: [], mcpServerIds: [] }),
        'quest-cave',
        now,
        now,
      );
      process.stdout.write(`Created Phase 5 demo quest: ${phase5Title} (${activeQuestId})\n`);
    }

    // Always create a fresh active agent so advance-scene can proceed
    const demoAgentId = crypto.randomUUID();
    db.prepare(
      'INSERT INTO agents (id, adventurer_id, quest_id, started_at, events_json) VALUES (?, ?, ?, ?, ?)',
    ).run(
      demoAgentId,
      adventurer.id,
      activeQuestId,
      now,
      JSON.stringify([
        { type: 'progress', timestamp: now, message: 'Delving deeper into the cave...' },
      ]),
    );
    process.stdout.write(`Created active agent for Phase 5 demo quest (${demoAgentId})\n`);
  }

  if (process.argv.includes('--phase-10-demo')) {
    seedPhase10Demo(db);
  }

  process.stdout.write('Seed complete.\n');
}

function seedPhase10Demo(db: ReturnType<typeof openDb>) {
  const now = new Date().toISOString();

  // Adventurer for the demo
  let demoAdventurerId: string;
  const existingDemo = db
    .prepare("SELECT id FROM adventurers WHERE name = 'Aldric the Learned'")
    .get() as { id: string } | undefined;

  if (existingDemo) {
    demoAdventurerId = existingDemo.id;
    process.stdout.write(`Using existing adventurer: Aldric the Learned (${demoAdventurerId})\n`);
  } else {
    demoAdventurerId = crypto.randomUUID();
    db.prepare(
      'INSERT INTO adventurers (id, name, class, model_id, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(demoAdventurerId, 'Aldric the Learned', 'champion', 'default', now);
    process.stdout.write(`Created adventurer: Aldric the Learned (${demoAdventurerId})\n`);
  }

  // Epic for the demo
  let demoEpicId: string;
  const existingDemoEpic = db
    .prepare("SELECT id FROM epics WHERE title = 'Phase 10 Demo Epic'")
    .get() as { id: string } | undefined;

  if (existingDemoEpic) {
    demoEpicId = existingDemoEpic.id;
  } else {
    demoEpicId = crypto.randomUUID();
    db.prepare('INSERT INTO epics (id, title, goal, created_at) VALUES (?, ?, ?, ?)').run(
      demoEpicId,
      'Phase 10 Demo Epic',
      'Demonstrate the Phase 10 self-improvement learning loop',
      now,
    );
    process.stdout.write(`Created epic: Phase 10 Demo Epic (${demoEpicId})\n`);
  }

  // 2 demo quests (complete, with the demo adventurer)
  const demoQuests = [
    {
      title: 'Phase 10 Demo: Fix lint violations in auth module',
      description: 'Address ESLint errors in the authentication module.',
    },
    {
      title: 'Phase 10 Demo: Fix lint violations in payments module',
      description: 'Address ESLint errors in the payments module.',
    },
  ];

  const demoQuestIds: string[] = [];
  for (const q of demoQuests) {
    const existing = db.prepare('SELECT id FROM quests WHERE title = ?').get(q.title) as
      | { id: string }
      | undefined;
    if (existing) {
      demoQuestIds.push(existing.id);
    } else {
      const questId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO quests (id, epic_id, title, description, acceptance_criteria_json,
          edge_cases_json, context, status, adventurer_id, equipment_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        questId,
        demoEpicId,
        q.title,
        q.description,
        JSON.stringify(['All lint errors resolved']),
        JSON.stringify([]),
        '',
        'complete',
        demoAdventurerId,
        JSON.stringify({ skillIds: [], toolIds: [], mcpServerIds: [] }),
        now,
        now,
      );
      demoQuestIds.push(questId);
      process.stdout.write(`Created demo quest: ${q.title} (${questId})\n`);
    }
  }

  // goblin_linter monster (project-scoped)
  let goblinMonsterId: string;
  const existingGoblin = db
    .prepare(
      "SELECT id FROM monsters WHERE type_id = 'goblin_linter' AND name = 'Phase 10 Demo Goblin'",
    )
    .get() as { id: string } | undefined;

  if (existingGoblin) {
    goblinMonsterId = existingGoblin.id;
  } else {
    goblinMonsterId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO monsters (id, type_id, name, scope, first_seen_at, last_seen_at)
       VALUES (?, 'goblin_linter', 'Phase 10 Demo Goblin', 'project', ?, ?)`,
    ).run(goblinMonsterId, now, now);
    process.stdout.write(`Created demo goblin monster (${goblinMonsterId})\n`);
  }

  // 3 victorious encounters (distribute across the 2 demo quests)
  const encounterAssignments = [demoQuestIds[0], demoQuestIds[0], demoQuestIds[1]];
  let encountersCreated = 0;

  for (let i = 0; i < encounterAssignments.length; i++) {
    const questId = encounterAssignments[i];
    const checkKey = `Phase 10 Demo encounter ${i + 1}`;
    const existing = db
      .prepare(
        "SELECT id FROM monster_encounters WHERE monster_id = ? AND quest_id = ? AND combat_log_json LIKE ?",
      )
      .get(goblinMonsterId, questId, `%${checkKey}%`) as { id: string } | undefined;

    if (!existing) {
      const encId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO monster_encounters
           (id, monster_id, quest_id, appeared_at, combat_log_json, outcome, loot_json, resolved_at)
         VALUES (?, ?, ?, ?, ?, 'victory', '[]', ?)`,
      ).run(
        encId,
        goblinMonsterId,
        questId,
        now,
        JSON.stringify([checkKey]),
        now,
      );
      encountersCreated++;
    }
  }

  if (encountersCreated > 0) {
    process.stdout.write(`Created ${encountersCreated} demo monster encounters\n`);
  }

  // Trigger skill candidate evaluation
  const result = evaluateSkillCandidate(db, {
    adventurerId: demoAdventurerId,
    monsterTypeId: 'goblin_linter',
  });

  if (result.created) {
    process.stdout.write(`Created skill candidate for goblin_linter (id: ${result.skillId ?? '?'})\n`);
  } else if (result.updated) {
    process.stdout.write(`Updated existing skill for goblin_linter (id: ${result.skillId ?? '?'})\n`);
  } else {
    process.stdout.write('Skill candidate already exists or threshold not yet met\n');
  }
}

seed();
