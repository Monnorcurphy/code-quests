import { openDb } from '../db/connection';
import { runMigrations } from '../db/migrator';

function seedDemoQuest() {
  if (process.env.NODE_ENV === 'production') {
    process.stderr.write('seed-demo-quest.ts must not run in production\n');
    process.exit(1);
  }

  const db = openDb();
  runMigrations(db);

  const now = new Date().toISOString();
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const sixMinAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();

  // Epic
  const existingEpic = db.prepare("SELECT id FROM epics WHERE title = 'Phase 6 Demo'").get() as { id: string } | undefined;
  let epicId: string;
  if (existingEpic) {
    epicId = existingEpic.id;
  } else {
    epicId = crypto.randomUUID();
    db.prepare('INSERT INTO epics (id, title, goal, created_at) VALUES (?, ?, ?, ?)').run(
      epicId,
      'Phase 6 Demo',
      'Demonstrate Phase 6 monster combat end-to-end',
      now,
    );
    process.stdout.write(`Created epic: Phase 6 Demo (${epicId})\n`);
  }

  // Adventurer
  let adventurer = db
    .prepare("SELECT id FROM adventurers WHERE name = 'Brielle the Bold'")
    .get() as { id: string } | undefined;
  if (!adventurer) {
    const adventurerId = crypto.randomUUID();
    db.prepare(
      'INSERT INTO adventurers (id, name, class, model_id, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(adventurerId, 'Brielle the Bold', 'champion', 'default', now);
    adventurer = { id: adventurerId };
    process.stdout.write(`Created adventurer: Brielle the Bold (${adventurerId})\n`);
  }

  // Phase 6 demo quest — already completed so monsters and encounters persist on first load
  const demoTitle = 'Phase 6 Demo: Banish the TypeScript Poltergeist';
  const existingQuest = db
    .prepare('SELECT id FROM quests WHERE title = ?')
    .get(demoTitle) as { id: string } | undefined;

  let questId: string;
  if (existingQuest) {
    questId = existingQuest.id;
    process.stdout.write(`Phase 6 demo quest already exists (${questId})\n`);
  } else {
    questId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO quests (id, epic_id, title, description, acceptance_criteria_json,
        edge_cases_json, context, status, adventurer_id, equipment_json, current_scene,
        created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      questId,
      epicId,
      demoTitle,
      'Fix persistent TypeScript type errors that keep resurfacing across refactors. ' +
        'Three separate type mismatches have appeared — clearly a pattern.',
      JSON.stringify([
        'All TypeScript errors resolved',
        'No lint violations remain',
        'Flaky test stabilised with deterministic fixtures',
      ]),
      JSON.stringify([
        'Type error returns after merge',
        'Lint rule newly added by dependency upgrade',
      ]),
      'Branch: feat/type-cleanup. Three TS4XXX errors, one eslint no-unused-vars, one flaky integration test.',
      'complete',
      adventurer.id,
      JSON.stringify({ skillIds: [], toolIds: [], mcpServerIds: [] }),
      'quest-boss-room',
      sixMinAgo,
      fiveMinAgo,
    );
    process.stdout.write(`Created Phase 6 demo quest: ${demoTitle} (${questId})\n`);
  }

  // Agent record for the completed quest
  const existingAgent = db
    .prepare('SELECT id FROM agents WHERE quest_id = ?')
    .get(questId) as { id: string } | undefined;
  let agentId: string;
  if (existingAgent) {
    agentId = existingAgent.id;
  } else {
    agentId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO agents (id, adventurer_id, quest_id, started_at, ended_at, exit_code, events_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(agentId, adventurer.id, questId, sixMinAgo, fiveMinAgo, 0, JSON.stringify([]));
    db.prepare('UPDATE quests SET agent_id = ? WHERE id = ?').run(agentId, questId);
    process.stdout.write(`Created agent for Phase 6 demo quest (${agentId})\n`);
  }

  // Seed monsters if not already present
  function upsertMonster(opts: {
    typeId: string;
    name: string;
    scope: 'project' | 'guild';
    projectId: string | null;
    encounters: number;
    defeats: number;
    escapes: number;
    calibratedDifficulty: number;
  }): string {
    const existing = db
      .prepare('SELECT id FROM monsters WHERE type_id = ? AND scope = ? AND (project_id = ? OR (project_id IS NULL AND ? IS NULL))')
      .get(opts.typeId, opts.scope, opts.projectId, opts.projectId) as { id: string } | undefined;
    if (existing) return existing.id;
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO monsters
         (id, type_id, name, scope, project_id, first_seen_at, last_seen_at,
          encounters, defeats, escapes, calibrated_difficulty, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '')`,
    ).run(id, opts.typeId, opts.name, opts.scope, opts.projectId, sixMinAgo, fiveMinAgo,
      opts.encounters, opts.defeats, opts.escapes, opts.calibratedDifficulty);
    process.stdout.write(`Created monster: ${opts.name} (${id})\n`);
    return id;
  }

  // Three Imp encounters (same type) + Goblin + Wraith + Lich (from aggregator)
  const impId = upsertMonster({
    typeId: 'imp_typecheck', name: 'Grim the Type-Gremlin',
    scope: 'project', projectId: questId,
    encounters: 3, defeats: 3, escapes: 0, calibratedDifficulty: 1,
  });
  const goblinId = upsertMonster({
    typeId: 'goblin_linter', name: 'Nibble the Nit-Picker',
    scope: 'project', projectId: questId,
    encounters: 1, defeats: 1, escapes: 0, calibratedDifficulty: 1,
  });
  const wraithId = upsertMonster({
    typeId: 'wraith_flaky_test', name: 'Shimmer the Flicker',
    scope: 'project', projectId: questId,
    encounters: 1, defeats: 1, escapes: 0, calibratedDifficulty: 3,
  });
  const lichId = upsertMonster({
    typeId: 'lich_repeated_failure', name: 'Vex the Perpetual',
    scope: 'project', projectId: questId,
    encounters: 1, defeats: 1, escapes: 0, calibratedDifficulty: 5,
  });

  function upsertEncounter(opts: {
    monsterId: string;
    questId: string;
    appearedAt: string;
    outcome: 'victory' | 'defeat' | 'escape';
    combatLog: string[];
  }): void {
    const existing = db
      .prepare('SELECT id FROM monster_encounters WHERE monster_id = ? AND quest_id = ? AND appeared_at = ?')
      .get(opts.monsterId, opts.questId, opts.appearedAt);
    if (existing) return;
    const id = crypto.randomUUID();
    const resolvedAt = new Date(new Date(opts.appearedAt).getTime() + 45_000).toISOString();
    db.prepare(
      `INSERT INTO monster_encounters
         (id, monster_id, quest_id, appeared_at, combat_log_json, outcome, loot_json, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, '[]', ?)`,
    ).run(id, opts.monsterId, opts.questId, opts.appearedAt,
      JSON.stringify(opts.combatLog), opts.outcome, resolvedAt);
  }

  const t = (offsetMs: number) =>
    new Date(new Date(sixMinAgo).getTime() + offsetMs).toISOString();

  upsertEncounter({
    monsterId: impId, questId, appearedAt: t(10_000), outcome: 'victory',
    combatLog: ['TS2345: Argument of type string is not assignable to parameter of type number'],
  });
  upsertEncounter({
    monsterId: goblinId, questId, appearedAt: t(40_000), outcome: 'victory',
    combatLog: ['eslint: no-unused-vars — variable "result" is defined but never used'],
  });
  upsertEncounter({
    monsterId: impId, questId, appearedAt: t(80_000), outcome: 'victory',
    combatLog: ['TS2339: Property "id" does not exist on type "Response"'],
  });
  upsertEncounter({
    monsterId: wraithId, questId, appearedAt: t(120_000), outcome: 'victory',
    combatLog: ['Test sometimes fails: timeout after 5000ms — intermittent race condition'],
  });
  upsertEncounter({
    monsterId: impId, questId, appearedAt: t(160_000), outcome: 'victory',
    combatLog: ['TS4056: Return type of exported function cannot be named'],
  });
  upsertEncounter({
    monsterId: lichId, questId, appearedAt: t(180_000), outcome: 'victory',
    combatLog: ['The same Imp has struck 3 times — a Lich emerges from the pattern!'],
  });

  process.stdout.write('Phase 6 demo seed complete.\n');
}

seedDemoQuest();
