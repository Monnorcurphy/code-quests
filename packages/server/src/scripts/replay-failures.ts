/**
 * replay-failures.ts
 *
 * Replays a scripted sequence of agent events through the monster-detection
 * pipeline so the orchestrator creates monsters end-to-end — without needing
 * a real claude code subprocess or running HTTP server.
 *
 * Usage:
 *   pnpm --filter=@code-quests/server exec tsx src/scripts/replay-failures.ts [fixture.json]
 *
 * If no fixture path is given, the built-in Phase 6 demo fixture is used.
 * Run seed-demo-quest.ts first to ensure the demo quest exists.
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDb } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { transitionQuestStatus } from '../services/quest-status';
import { classifyCombatEvent, recordEncounter, resolveEncounter } from '../services/monster-detection';
import { createAgent, endAgent } from '../services/agents-service';
import { LICH_REPEAT_THRESHOLD } from '../services/quest-runner';
import { getMonsterType } from '../services/monster-types';
import type { AgentEvent } from '@code-quests/shared';

const BUILT_IN_FIXTURE: AgentEvent[] = [
  {
    type: 'progress',
    timestamp: new Date().toISOString(),
    message: 'Setting out from the guild hall',
  },
  {
    type: 'combat',
    timestamp: new Date().toISOString(),
    monsterTypeId: 'imp_typecheck',
    message: 'TS2345: Argument of type string is not assignable to parameter of type number',
  },
  {
    type: 'progress',
    timestamp: new Date().toISOString(),
    message: 'Pushing deeper into the dungeon',
  },
  {
    type: 'combat',
    timestamp: new Date().toISOString(),
    monsterTypeId: 'goblin_linter',
    message: 'eslint: no-unused-vars — variable "result" is defined but never used',
  },
  {
    type: 'progress',
    timestamp: new Date().toISOString(),
    message: 'Crossing the bridge of uncertainty',
  },
  {
    type: 'combat',
    timestamp: new Date().toISOString(),
    monsterTypeId: 'imp_typecheck',
    message: 'TS2339: Property "id" does not exist on type "Response"',
  },
  {
    type: 'progress',
    timestamp: new Date().toISOString(),
    message: 'Resting near the ancient stones',
  },
  {
    type: 'combat',
    timestamp: new Date().toISOString(),
    monsterTypeId: 'wraith_flaky_test',
    message: 'Test sometimes fails: timeout after 5000ms — intermittent race condition',
  },
  {
    type: 'progress',
    timestamp: new Date().toISOString(),
    message: 'The boss chamber lies ahead',
  },
  {
    type: 'combat',
    timestamp: new Date().toISOString(),
    monsterTypeId: 'imp_typecheck',
    message: 'TS4056: Return type of exported function cannot be named',
  },
  {
    type: 'completed',
    timestamp: new Date().toISOString(),
    summary: 'All TypeScript errors resolved. Lint clean. Flaky test stabilised.',
  },
];

function loadFixture(fixturePath?: string): AgentEvent[] {
  if (!fixturePath) return BUILT_IN_FIXTURE;
  const raw = fs.readFileSync(path.resolve(fixturePath), 'utf8');
  return JSON.parse(raw) as AgentEvent[];
}

async function main() {
  const fixturePath = process.argv[2];
  const fixture = loadFixture(fixturePath);

  const db = openDb();
  runMigrations(db);

  let questRow = db
    .prepare(
      "SELECT * FROM quests WHERE title LIKE '%Phase 6 Demo%' AND status = 'idle' LIMIT 1",
    )
    .get() as Record<string, unknown> | undefined;

  if (!questRow) {
    // Auto-create a fresh idle quest for replay
    process.stdout.write('No idle Phase 6 Demo quest found — creating one for replay.\n');
    let adventurer = db
      .prepare("SELECT id FROM adventurers WHERE name = 'Brielle the Bold'")
      .get() as { id: string } | undefined;
    if (!adventurer) {
      const advId = randomUUID();
      db.prepare('INSERT INTO adventurers (id, name, class, model_id, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(advId, 'Brielle the Bold', 'champion', 'default', new Date().toISOString());
      adventurer = { id: advId };
    }

    let epicId: string;
    const existingEpic = db.prepare("SELECT id FROM epics WHERE title = 'Phase 6 Demo'").get() as { id: string } | undefined;
    if (existingEpic) {
      epicId = existingEpic.id;
    } else {
      epicId = randomUUID();
      db.prepare('INSERT INTO epics (id, title, goal, created_at) VALUES (?, ?, ?, ?)')
        .run(epicId, 'Phase 6 Demo', 'Demonstrate Phase 6 monster combat', new Date().toISOString());
    }

    const questId = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO quests (id, epic_id, title, description, acceptance_criteria_json,
         edge_cases_json, context, status, adventurer_id, equipment_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?, ?, ?)`,
    ).run(
      questId, epicId,
      'Phase 6 Demo: Replay Run',
      'Replay fixture to demonstrate monster detection pipeline.',
      '[]', '[]', '',
      adventurer.id,
      JSON.stringify({ skillIds: [], toolIds: [], mcpServerIds: [] }),
      now, now,
    );
    questRow = db.prepare('SELECT * FROM quests WHERE id = ?').get(questId) as Record<string, unknown>;
    process.stdout.write(`Created replay quest: ${questId}\n`);
  }

  const questId = questRow['id'] as string;
  const adventurerId = questRow['adventurer_id'] as string;

  transitionQuestStatus(db, questId, 'idle', 'active');

  const agent = createAgent(db, { adventurerId, questId, pid: null });
  db.prepare('UPDATE quests SET agent_id = ?, updated_at = ? WHERE id = ?').run(
    agent.id,
    new Date().toISOString(),
    questId,
  );

  process.stdout.write(`Replaying ${fixture.length} events for quest: ${questRow['title'] as string}\n`);

  const pendingEncounters: string[] = [];
  const typeCountMap = new Map<string, number>();

  for (const event of fixture) {
    await new Promise<void>((r) => setTimeout(r, 150));

    if (event.type === 'progress') {
      process.stdout.write(`  [progress] ${event.message}\n`);
      continue;
    }

    if (event.type === 'combat') {
      const monsterType = classifyCombatEvent(db, event);
      if (!monsterType) {
        process.stdout.write(`  [combat] no match: ${event.message.slice(0, 60)}\n`);
        continue;
      }

      const { monster, encounter } = recordEncounter(db, {
        questId,
        monsterTypeId: monsterType.id,
        combatLogEntry: event.message,
      });
      pendingEncounters.push(encounter.id);
      process.stdout.write(`  [combat] ${monster.name} (${monsterType.name}) appeared\n`);

      if (monsterType.id !== 'lich_repeated_failure') {
        const count = (typeCountMap.get(monsterType.id) ?? 0) + 1;
        typeCountMap.set(monsterType.id, count);
        if (count === LICH_REPEAT_THRESHOLD) {
          const lichType = getMonsterType(db, 'lich_repeated_failure');
          if (lichType) {
            const lichMsg = `The same ${monsterType.name} has struck ${LICH_REPEAT_THRESHOLD} times — a Lich emerges!`;
            const { monster: lich, encounter: lichEnc } = recordEncounter(db, {
              questId,
              monsterTypeId: 'lich_repeated_failure',
              combatLogEntry: lichMsg,
            });
            pendingEncounters.push(lichEnc.id);
            process.stdout.write(`  [lich] ${lich.name} appeared (lich aggregator triggered)\n`);
          }
        }
      }
    }

    if (event.type === 'completed') {
      for (const encId of pendingEncounters) {
        resolveEncounter(db, encId, 'victory');
      }
      db.prepare(
        "UPDATE quests SET status = 'complete', updated_at = ? WHERE id = ?",
      ).run(new Date().toISOString(), questId);
      endAgent(db, agent.id, 0);
      process.stdout.write('  [completed] quest finished — all encounters resolved as victories\n');
    }
  }

  process.stdout.write('Replay complete.\n');
  db.close();
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`replay-failures: ${msg}\n`);
  process.exit(1);
});
