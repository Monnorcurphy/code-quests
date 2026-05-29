import Database from 'better-sqlite3';
import type { ScarRecord } from '@code-quests/shared';
import { openDb } from '../db/connection';
import { runMigrations } from '../db/migrator';

export function seedShowcase(db: Database.Database): string {
  const now = new Date().toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Epic
  db.prepare(
    `INSERT OR IGNORE INTO epics (id, title, goal, created_at) VALUES (?, ?, ?, ?)`,
  ).run(
    'epic-showcase-auth',
    'Modernize the Auth System',
    'Migrate authentication infrastructure to modern JWT-based approach with improved security and UX',
    now,
  );

  // Skills — update hit counts and status for the showcase scenario
  // These rows already exist from migration 002_seed_equipment.sql
  db.prepare(`UPDATE skills SET hit_count = ?, monster_type_ids_json = ? WHERE id = ?`).run(
    11,
    JSON.stringify(['goblin_linter', 'imp_typecheck']),
    'linters_bane',
  );
  db.prepare(`UPDATE skills SET hit_count = ?, monster_type_ids_json = ? WHERE id = ?`).run(
    7,
    JSON.stringify(['imp_typecheck']),
    'type_whisperer',
  );
  db.prepare(`UPDATE skills SET hit_count = ?, monster_type_ids_json = ? WHERE id = ?`).run(
    3,
    JSON.stringify(['wraith_flaky_test']),
    'wraith_banisher',
  );
  // ac_cartographer is surfaced as a candidate for user confirmation in the demo
  db.prepare(`UPDATE skills SET status = 'candidate', monster_type_ids_json = ? WHERE id = ?`).run(
    JSON.stringify(['hydra_ac_mismatch']),
    'ac_cartographer',
  );

  // Adventurers
  const brielleStats = { questsWon: 8, monstersSlain: { goblin_linter: 8, imp_typecheck: 4 } };
  db.prepare(
    `INSERT OR IGNORE INTO adventurers
       (id, name, class, model_id, stats_json, specializations_json, scars_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    'adv-showcase-brielle',
    'Brielle the Bold',
    'champion',
    'claude-opus-4-7',
    JSON.stringify(brielleStats),
    JSON.stringify(['type_safety', 'refactoring']),
    JSON.stringify([]),
    now,
  );

  const tessStats = { questsWon: 2, monstersSlain: { goblin_linter: 2 } };
  const tessScar: ScarRecord = {
    questId: 'quest-demo-pre-scar',
    failureSummary: 'Acceptance criteria mismatch caused quest failure on a prior auth task',
    monsterIdAtFatal: 'the-jwt-hydra',
    occurredAt: weekAgo,
  };
  db.prepare(
    `INSERT OR IGNORE INTO adventurers
       (id, name, class, model_id, stats_json, specializations_json, scars_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    'adv-showcase-tess',
    'Tess the Tenacious',
    'scout',
    'claude-haiku-4-5-20251001',
    JSON.stringify(tessStats),
    JSON.stringify(['frontend', 'copy_editing']),
    JSON.stringify([tessScar]),
    now,
  );

  const rookStats = { questsWon: 0, monstersSlain: {} };
  db.prepare(
    `INSERT OR IGNORE INTO adventurers
       (id, name, class, model_id, stats_json, specializations_json, scars_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    'adv-showcase-rook',
    'Rook the Resolute',
    'scout',
    'claude-haiku-4-5-20251001',
    JSON.stringify(rookStats),
    JSON.stringify([]),
    JSON.stringify([]),
    now,
  );

  // Monsters
  db.prepare(
    `INSERT OR IGNORE INTO monsters
       (id, type_id, name, scope, encounters, defeats, escapes, calibrated_difficulty,
        first_seen_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    'grognak-the-lint-goblin',
    'goblin_linter',
    'Grognak the Lint Goblin',
    'guild',
    12,
    11,
    1,
    2,
    weekAgo,
    now,
  );

  db.prepare(
    `INSERT OR IGNORE INTO monsters
       (id, type_id, name, scope, calibrated_difficulty, first_seen_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    'the-jwt-hydra',
    'hydra_ac_mismatch',
    'The JWT Hydra',
    'project',
    4,
    now,
    now,
  );

  // Quests
  const jwtEquipment = {
    skillIds: ['type_whisperer'],
    toolIds: ['gh'],
    mcpServerIds: ['filesystem'],
  };
  db.prepare(
    `INSERT OR IGNORE INTO quests
       (id, epic_id, title, description, acceptance_criteria_json, edge_cases_json, context,
        status, equipment_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?, ?)`,
  ).run(
    'quest-showcase-jwt',
    'epic-showcase-auth',
    'Migrate to JWT',
    'Replace session-cookie authentication with JWT tokens. Update all API endpoints to validate JWT Bearer headers and implement refresh token rotation.',
    JSON.stringify([
      'All API endpoints accept and validate JWT Bearer tokens',
      'Existing sessions are invalidated on migration cutover',
      'JWT expiry is enforced server-side with a 15-minute TTL',
      'Refresh token rotation flow is implemented and covered by integration tests',
    ]),
    JSON.stringify([
      'Users with in-flight requests during migration cutover lose their session',
      'JWT secret rotation must work without service restart',
    ]),
    'See ADR-12 for the JWT library decision. The chosen library must be audited for CVEs.',
    JSON.stringify(jwtEquipment),
    now,
    now,
  );

  const copyEquipment = {
    skillIds: ['linters_bane'],
    toolIds: [],
    mcpServerIds: [],
  };
  db.prepare(
    `INSERT OR IGNORE INTO quests
       (id, epic_id, title, description, acceptance_criteria_json, edge_cases_json, context,
        status, equipment_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?, ?)`,
  ).run(
    'quest-showcase-copy',
    'epic-showcase-auth',
    'Update login form copy',
    'Update all user-facing copy on the login and registration forms to match the new brand voice guidelines. Ensure aria-labels are updated in lockstep.',
    JSON.stringify([
      'All button labels use sentence case per the brand guide',
      'Error messages match the approved copy list in docs/copy.md',
    ]),
    JSON.stringify([
      'Screen-reader users relying on existing aria-labels must not regress',
    ]),
    'Brand voice guidelines are in Notion under "Marketing / Voice & Tone".',
    JSON.stringify(copyEquipment),
    now,
    now,
  );

  const meterEquipment = {
    skillIds: ['wraith_banisher'],
    toolIds: [],
    mcpServerIds: [],
  };
  db.prepare(
    `INSERT OR IGNORE INTO quests
       (id, epic_id, title, description, acceptance_criteria_json, edge_cases_json, context,
        status, equipment_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?, ?)`,
  ).run(
    'quest-showcase-meter',
    'epic-showcase-auth',
    'Add password strength meter',
    'Add a visual password strength indicator to the registration form that evaluates complexity in real time using the zxcvbn scoring library.',
    JSON.stringify([
      'Strength meter renders with four levels: weak, fair, strong, very strong',
      'Meter updates on every keystroke with no perceptible lag on a 2015 laptop',
      'Color is not the only indicator — each level also has a text label and icon per WCAG',
    ]),
    JSON.stringify([
      'Mobile keyboards that hide the password while typing',
      'prefers-reduced-motion users must see no animation on the meter fill',
    ]),
    'Use zxcvbn (MIT) for strength scoring. The bundle impact must stay under 20 KB gzipped.',
    JSON.stringify(meterEquipment),
    now,
    now,
  );

  return 'epic-showcase-auth';
}

function main() {
  if (process.env['CODE_QUESTS_ENV'] === 'production') {
    process.stderr.write('seed-showcase.ts must not run in production\n');
    process.exit(1);
  }

  const db = openDb();
  runMigrations(db);
  const epicId = seedShowcase(db);
  process.stdout.write(`Showcase seeded. Epic id: ${epicId}\n`);
}

if (require.main === module) {
  main();
}
