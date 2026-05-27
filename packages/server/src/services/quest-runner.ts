import type Database from 'better-sqlite3';
import type { AgentEvent, Quest, Adventurer, Agent } from '@code-quests/shared';
import type { AgentHandle } from '../agents/adapter';
import { createAgent, endAgent } from './agents-service';
import { getQuestAdapter } from '../agents/select-adapter';
import { transitionQuestStatus, InvalidTransitionError } from './quest-status';

const COMBAT_LOG_MAX_CHARS = 5000;

export interface RunQuestDeps {
  db: Database.Database;
  publishEvent?: (questId: string, event: AgentEvent) => void;
}

export interface QuestRunResult {
  agent: Agent;
  done: Promise<void>;
}

const activeHandles = new Map<string, AgentHandle>();

export function getActiveHandle(questId: string): AgentHandle | undefined {
  return activeHandles.get(questId);
}

export async function runQuest(
  quest: Quest,
  adventurer: Adventurer,
  deps: RunQuestDeps,
): Promise<QuestRunResult> {
  const { db, publishEvent } = deps;
  const adapter = getQuestAdapter();
  if (!adapter.spawn) {
    throw new Error(`Quest adapter '${adapter.name}' does not support spawning agents`);
  }

  const handle = await adapter.spawn({
    questId: quest.id,
    adventurerId: adventurer.id,
    adventurerName: adventurer.name,
    adventurerClass: adventurer.class,
    modelId: adventurer.modelId,
    description: quest.description,
    acceptanceCriteria: quest.acceptanceCriteria,
    equipment: quest.equipment,
  });

  const agent = createAgent(db, {
    adventurerId: adventurer.id,
    questId: quest.id,
    pid: handle.pid,
  });

  const now = new Date().toISOString();
  db.prepare('UPDATE quests SET agent_id = ?, updated_at = ? WHERE id = ?').run(agent.id, now, quest.id);

  activeHandles.set(quest.id, handle);

  const done = (async () => {
    let combatLog = '';
    try {
      for await (const event of handle.events()) {
        publishEvent?.(quest.id, event);
        const entry = JSON.stringify(event) + '\n';
        if (combatLog.length + entry.length <= COMBAT_LOG_MAX_CHARS) {
          combatLog += entry;
        }
        if (event.type === 'completed') {
          try {
            transitionQuestStatus(db, quest.id, 'active', 'complete');
          } catch (err) {
            if (!(err instanceof InvalidTransitionError)) throw err;
          }
          endAgent(db, agent.id, 0);
          return;
        }
        if (event.type === 'failed') {
          const failureSummary = {
            reason: event.reason ?? '',
            recommendation: 'repost_with_clarification' as const,
          };
          const ts = new Date().toISOString();
          db.prepare('UPDATE quests SET failure_summary_json = ?, updated_at = ? WHERE id = ?')
            .run(JSON.stringify(failureSummary), ts, quest.id);
          try {
            transitionQuestStatus(db, quest.id, 'active', 'failed');
          } catch (err) {
            if (!(err instanceof InvalidTransitionError)) throw err;
          }
          endAgent(db, agent.id, 1);
          return;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[quest-runner] event loop error for quest ${quest.id}: ${msg}\n`);
    } finally {
      activeHandles.delete(quest.id);
    }
  })();

  return { agent, done };
}
