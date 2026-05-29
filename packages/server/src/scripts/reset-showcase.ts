import Database from 'better-sqlite3';
import { openDb } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { seedShowcase } from './seed-showcase';

const SHOWCASE_QUEST_IDS = [
  'quest-showcase-jwt',
  'quest-showcase-copy',
  'quest-showcase-meter',
];

const SHOWCASE_MONSTER_IDS = ['grognak-the-lint-goblin', 'the-jwt-hydra'];

function clearShowcaseData(db: Database.Database): void {
  const placeholders = SHOWCASE_QUEST_IDS.map(() => '?').join(',');

  // Remove encounters referencing showcase quests or monsters first (FK child)
  db.prepare(
    `DELETE FROM monster_encounters
     WHERE quest_id IN (${placeholders})
        OR monster_id IN (${SHOWCASE_MONSTER_IDS.map(() => '?').join(',')})`,
  ).run(...SHOWCASE_QUEST_IDS, ...SHOWCASE_MONSTER_IDS);

  // Remove agents referencing showcase quests or showcase adventurers
  db.prepare(
    `DELETE FROM agents
     WHERE quest_id IN (${placeholders})
        OR adventurer_id IN ('adv-showcase-brielle','adv-showcase-tess','adv-showcase-rook')`,
  ).run(...SHOWCASE_QUEST_IDS);

  // Remove showcase quests (references epic and adventurer FKs)
  db.prepare(`DELETE FROM quests WHERE id IN (${placeholders})`).run(...SHOWCASE_QUEST_IDS);

  // Remove showcase monsters
  db.prepare(
    `DELETE FROM monsters WHERE id IN (${SHOWCASE_MONSTER_IDS.map(() => '?').join(',')})`,
  ).run(...SHOWCASE_MONSTER_IDS);

  // Remove showcase adventurers
  db.prepare(
    `DELETE FROM adventurers
     WHERE id IN ('adv-showcase-brielle','adv-showcase-tess','adv-showcase-rook')`,
  ).run();

  // Remove showcase epic
  db.prepare(`DELETE FROM epics WHERE id = 'epic-showcase-auth'`).run();

  // Reset skill state to migration defaults so the seed can reapply showcase values
  db.prepare(
    `UPDATE skills SET hit_count = 0, status = 'active',
        monster_type_ids_json = '[]'
     WHERE id IN ('linters_bane','type_whisperer','wraith_banisher','ac_cartographer')`,
  ).run();
}

export function resetShowcase(db: Database.Database): string {
  if (process.env['CODE_QUESTS_ENV'] !== 'demo') {
    throw new Error('Showcase reset is only allowed when CODE_QUESTS_ENV=demo');
  }

  clearShowcaseData(db);
  return seedShowcase(db);
}

function main() {
  if (process.env['CODE_QUESTS_ENV'] !== 'demo') {
    process.stderr.write(
      'ERROR: Showcase reset requires CODE_QUESTS_ENV=demo.\n' +
        'This guardrail prevents wiping a real user\'s database.\n' +
        'To run: CODE_QUESTS_ENV=demo pnpm --filter @code-quests/server reset:showcase\n',
    );
    process.exit(1);
  }

  const db = openDb();
  runMigrations(db);
  const epicId = resetShowcase(db);
  process.stdout.write(`Showcase reset complete. Epic id: ${epicId}\n`);
}

if (require.main === module) {
  main();
}
