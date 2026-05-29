import { openDb } from '../db/connection';
import { runMigrations } from '../db/migrator';

function seedPhase9() {
  if (process.env.NODE_ENV === 'production') {
    process.stderr.write('seed-dev-phase9.ts must not run in production\n');
    process.exit(1);
  }

  const db = openDb();
  runMigrations(db);
  db.pragma('foreign_keys = ON');

  const now = new Date().toISOString();
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  // Epic
  const existingEpic = db
    .prepare("SELECT id FROM epics WHERE title = 'Phase 9 Demo'")
    .get() as { id: string } | undefined;

  let epicId: string;
  if (existingEpic) {
    epicId = existingEpic.id;
    process.stdout.write(`Phase 9 demo epic already exists (${epicId})\n`);
  } else {
    epicId = crypto.randomUUID();
    db.prepare('INSERT INTO epics (id, title, goal, created_at) VALUES (?, ?, ?, ?)').run(
      epicId,
      'Phase 9 Demo',
      'Demonstrate the Phase 9 failure loop: return, review, re-post',
      now,
    );
    process.stdout.write(`Created epic: Phase 9 Demo (${epicId})\n`);
  }

  // Scarred adventurer — already has one scar so auto-match can penalise them
  const scarredName = 'Vance the Scarred';
  let scarredAdventurer = db
    .prepare('SELECT id FROM adventurers WHERE name = ?')
    .get(scarredName) as { id: string } | undefined;

  let scarredQuestId: string;

  if (!scarredAdventurer) {
    const advId = crypto.randomUUID();
    // We add the scar after creating the returned quest, so create the adventurer first
    db.prepare(
      'INSERT INTO adventurers (id, name, class, model_id, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(advId, scarredName, 'ranger', 'default', fifteenMinAgo);
    scarredAdventurer = { id: advId };
    process.stdout.write(`Created adventurer: ${scarredName} (${advId})\n`);
  }

  // Monster type for the fatal encounter (hydra = AC mismatch — already seeded by Phase 6)
  const monsterType = db
    .prepare("SELECT id FROM monster_types WHERE id = 'hydra_ac_mismatch'")
    .get() as { id: string } | undefined;

  const monsterTypeId = 'hydra_ac_mismatch';
  if (!monsterType) {
    db.prepare(
      `INSERT INTO monster_types (id, name, sprite_path, default_difficulty, failure_signature, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      'hydra_ac_mismatch',
      'Hydra (AC Mismatch)',
      '/sprites/monsters/hydra.png',
      4,
      'acceptance criteria|mismatch|ambiguous|unclear requirements',
      'system',
    );
    process.stdout.write(`Created monster type: hydra_ac_mismatch\n`);
  }

  // Fatal monster instance
  const fatalMonsterName = 'Mire the Criterion-Crusher';
  let fatalMonster = db
    .prepare('SELECT id FROM monsters WHERE name = ?')
    .get(fatalMonsterName) as { id: string } | undefined;

  if (!fatalMonster) {
    const monsterId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO monsters
         (id, type_id, name, scope, project_id, first_seen_at, last_seen_at,
          encounters, defeats, escapes, calibrated_difficulty, notes)
       VALUES (?, ?, ?, 'project', NULL, ?, ?, ?, ?, ?, ?, '')`,
    ).run(monsterId, monsterTypeId, fatalMonsterName, fifteenMinAgo, tenMinAgo, 2, 1, 0, 4);
    fatalMonster = { id: monsterId };
    process.stdout.write(`Created monster: ${fatalMonsterName} (${monsterId})\n`);
  }

  // The returned quest itself
  const returnedTitle = 'Phase 9 Demo: Migrate the payment gateway integration';
  const existingReturnedQuest = db
    .prepare('SELECT id FROM quests WHERE title = ?')
    .get(returnedTitle) as { id: string } | undefined;

  if (existingReturnedQuest) {
    scarredQuestId = existingReturnedQuest.id;
    process.stdout.write(`Phase 9 returned quest already exists (${scarredQuestId})\n`);
  } else {
    scarredQuestId = crypto.randomUUID();
    const failureSummary = {
      fatalEncounterId: '',
      retries: 1,
      recommendation: 'repost_with_clarification',
      notes:
        'The acceptance criteria were too vague — the Hydra monster (AC mismatch) appeared twice, ' +
        'indicating the quest spec did not clearly define success. Re-posting with tighter ACs is recommended.',
    };

    db.prepare(
      `INSERT INTO quests
         (id, epic_id, title, description, acceptance_criteria_json, edge_cases_json, context,
          status, adventurer_id, equipment_json, current_scene, failure_summary_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'returned_to_town', ?, '{}', 'quest-boss-room', ?, ?, ?)`,
    ).run(
      scarredQuestId,
      epicId,
      returnedTitle,
      'Swap out the legacy Stripe v2 integration for the new Stripe v3 SDK across the checkout service.',
      JSON.stringify([
        'Stripe v3 SDK initialised and authenticated',
        'All existing payment flows work end-to-end',
        'Webhooks validated against the new signature scheme',
      ]),
      JSON.stringify([
        'Legacy v2 API keys still in environment',
        'Partial refund edge case during migration window',
      ]),
      'Branch: feat/stripe-v3. The old integration uses stripe@2.x; the new SDK is stripe@14.x.',
      scarredAdventurer.id,
      JSON.stringify(failureSummary),
      fifteenMinAgo,
      tenMinAgo,
    );
    process.stdout.write(`Created returned quest: ${returnedTitle} (${scarredQuestId})\n`);
  }

  // Agent record for the returned quest
  const existingAgent = db
    .prepare('SELECT id FROM agents WHERE quest_id = ?')
    .get(scarredQuestId) as { id: string } | undefined;

  let agentId: string;
  if (existingAgent) {
    agentId = existingAgent.id;
  } else {
    agentId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO agents (id, adventurer_id, quest_id, started_at, ended_at, exit_code, events_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      agentId,
      scarredAdventurer.id,
      scarredQuestId,
      fifteenMinAgo,
      tenMinAgo,
      1,
      JSON.stringify([
        { type: 'progress', timestamp: fifteenMinAgo, message: 'Studying the Stripe API docs…' },
        {
          type: 'combat',
          timestamp: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
          message: 'Acceptance criteria mismatch detected — which payment flows count as "end-to-end"?',
        },
        {
          type: 'combat',
          timestamp: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
          message: 'Second AC mismatch: webhook validation scope still undefined.',
        },
        { type: 'failed', timestamp: tenMinAgo, reason: 'Acceptance criteria too vague to proceed.' },
      ]),
    );
    db.prepare('UPDATE quests SET agent_id = ? WHERE id = ?').run(agentId, scarredQuestId);
    process.stdout.write(`Created agent for returned quest (${agentId})\n`);
  }

  // Monster encounters for the returned quest
  const enc1Time = new Date(Date.now() - 14 * 60 * 1000).toISOString();
  const enc2Time = new Date(Date.now() - 11 * 60 * 1000).toISOString();

  const existingEnc = db
    .prepare('SELECT id FROM monster_encounters WHERE quest_id = ? LIMIT 1')
    .get(scarredQuestId) as { id: string } | undefined;

  let fatalEncounterId: string;
  if (!existingEnc) {
    const enc1Id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO monster_encounters
         (id, monster_id, quest_id, appeared_at, combat_log_json, outcome, loot_json, resolved_at)
       VALUES (?, ?, ?, ?, ?, 'escape', '[]', ?)`,
    ).run(
      enc1Id,
      fatalMonster.id,
      scarredQuestId,
      enc1Time,
      JSON.stringify([
        'Which payment flows count as end-to-end? The AC says "all" but the context implies only checkout.',
      ]),
      new Date(new Date(enc1Time).getTime() + 90_000).toISOString(),
    );

    fatalEncounterId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO monster_encounters
         (id, monster_id, quest_id, appeared_at, combat_log_json, outcome, loot_json, resolved_at)
       VALUES (?, ?, ?, ?, ?, 'defeat', '[]', ?)`,
    ).run(
      fatalEncounterId,
      fatalMonster.id,
      scarredQuestId,
      enc2Time,
      JSON.stringify([
        'Webhook validation scope still undefined. Cannot proceed without clearer ACs.',
        'Quest abandoned — retry budget exhausted.',
      ]),
      tenMinAgo,
    );

    // Update failure_summary_json with the real fatalEncounterId
    db.prepare(
      "UPDATE quests SET failure_summary_json = ? WHERE id = ?",
    ).run(
      JSON.stringify({
        fatalEncounterId,
        retries: 1,
        recommendation: 'repost_with_clarification',
        notes:
          'The acceptance criteria were too vague — the Hydra monster (AC mismatch) appeared twice, ' +
          'indicating the quest spec did not clearly define success. Re-posting with tighter ACs is recommended.',
      }),
      scarredQuestId,
    );

    process.stdout.write(`Created monster encounters for returned quest\n`);
  } else {
    fatalEncounterId = existingEnc.id;
  }

  // Add a scar to the scarred adventurer (if not already scarred)
  const advRow = db
    .prepare('SELECT scars_json FROM adventurers WHERE id = ?')
    .get(scarredAdventurer.id) as { scars_json: string };
  const existingScars = JSON.parse(advRow.scars_json) as unknown[];

  if (existingScars.length === 0) {
    const scar = {
      questId: scarredQuestId,
      failureSummary:
        'The acceptance criteria were too vague — the Hydra monster (AC mismatch) appeared twice.',
      monsterIdAtFatal: fatalMonster.id,
      occurredAt: tenMinAgo,
    };
    db.prepare('UPDATE adventurers SET scars_json = ? WHERE id = ?').run(
      JSON.stringify([scar]),
      scarredAdventurer.id,
    );
    process.stdout.write(`Added scar to adventurer: ${scarredName}\n`);
  }

  process.stdout.write('\nPhase 9 demo seed complete.\n');
  process.stdout.write(`  Returned quest: "${returnedTitle}" (id: ${scarredQuestId})\n`);
  process.stdout.write(`  Scarred adventurer: "${scarredName}" (id: ${scarredAdventurer.id})\n`);
  process.stdout.write('\nRun "pnpm dev" then navigate to the Town Square to see the badge.\n');
}

seedPhase9();
