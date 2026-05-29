import type Database from 'better-sqlite3';
import type { AgentEvent, Quest, Adventurer, Agent, InputRequest } from '@code-quests/shared';
import type { AgentHandle } from '../agents/adapter';
import { createAgent, endAgent } from './agents-service';
import { getQuestAdapter } from '../agents/select-adapter';
import { transitionQuestStatus, InvalidTransitionError } from './quest-status';
import { advanceQuestScene } from './quest-scene-progression';
import { classifyCombatEvent, recordEncounter, resolveEncounter } from './monster-detection';
import { getMonsterType } from './monster-types';
import { setInputRequest, clearInputRequest } from '../db/quest-repository';
import { frameInputRequest } from './adventure-framing';
import { detectAndHandleFailure } from '../lib/quest-failure-detector';

export const PROGRESS_EVENTS_PER_SCENE = 3;
export const LICH_REPEAT_THRESHOLD = 3;

export interface RunQuestDeps {
  db: Database.Database;
  publishEvent?: (questId: string, event: AgentEvent) => void;
}

export interface QuestRunResult {
  agent: Agent;
  done: Promise<void>;
}

const activeHandles = new Map<string, AgentHandle>();
const progressCountByQuest = new Map<string, number>();
const pendingEncountersByQuest = new Map<string, string[]>();
const typeCountsByQuest = new Map<string, Map<string, number>>();

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
  progressCountByQuest.set(quest.id, 0);
  pendingEncountersByQuest.set(quest.id, []);
  typeCountsByQuest.set(quest.id, new Map<string, number>());

  const done = (async () => {
    const collectedEvents: AgentEvent[] = [];
    function persistEvents() {
      db.prepare('UPDATE agents SET events_json = ? WHERE id = ?')
        .run(JSON.stringify(collectedEvents), agent.id);
    }
    try {
      for await (const event of handle.events()) {
        if (event.type === 'paused_input') {
          const ts = new Date().toISOString();
          try {
            transitionQuestStatus(db, quest.id, 'active', 'paused_input');
            const statusChangeEvent: AgentEvent = {
              type: 'status_change',
              timestamp: ts,
              from: 'active',
              to: 'paused_input',
            };
            collectedEvents.push(statusChangeEvent);
            publishEvent?.(quest.id, statusChangeEvent);
          } catch (err) {
            if (err instanceof InvalidTransitionError) {
              process.stderr.write(
                `[quest-runner] overwriting pending paused_input for quest ${quest.id}\n`,
              );
            } else {
              throw err;
            }
          }
          setInputRequest(db, quest.id, {
            question: event.question,
            context: event.context,
            awaitingSince: event.timestamp,
          });
          collectedEvents.push(event);
          publishEvent?.(quest.id, event);
          persistEvents();

          // Async framing — non-blocking. Parchment modal renders raw question immediately;
          // framing follow-up event updates it once the haiku call completes.
          const capturedEvent = event;
          void (async () => {
            try {
              const adventureFraming = await frameInputRequest(
                capturedEvent.question,
                adventurer.name,
                capturedEvent.context,
              );
              // Gate: discard framing if the quest already moved past paused_input.
              // Re-read the DB so we don't overwrite NULL (cleared by resumed) or a new cycle.
              const currentRow = db
                .prepare('SELECT input_request_json FROM quests WHERE id = ?')
                .get(quest.id) as { input_request_json: string | null } | undefined;
              if (!currentRow?.input_request_json) return;
              const currentRequest = JSON.parse(currentRow.input_request_json) as { awaitingSince?: string };
              if (currentRequest.awaitingSince !== capturedEvent.timestamp) return;

              const updatedRequest: InputRequest = {
                question: capturedEvent.question,
                context: capturedEvent.context,
                awaitingSince: capturedEvent.timestamp,
                adventureFraming,
              };
              setInputRequest(db, quest.id, updatedRequest);
              const framingEvent: AgentEvent = {
                type: 'paused_input',
                timestamp: new Date().toISOString(),
                question: capturedEvent.question,
                context: capturedEvent.context,
                adventureFraming,
              };
              collectedEvents.push(framingEvent);
              persistEvents();
              publishEvent?.(quest.id, framingEvent);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              process.stderr.write(
                `[quest-runner] framing update error for quest ${quest.id}: ${msg}\n`,
              );
            }
          })();

          continue;
        }

        if (event.type === 'resumed') {
          try {
            transitionQuestStatus(db, quest.id, 'paused_input', 'active');
            const statusChangeEvent: AgentEvent = {
              type: 'status_change',
              timestamp: event.timestamp,
              from: 'paused_input',
              to: 'active',
            };
            collectedEvents.push(statusChangeEvent);
            publishEvent?.(quest.id, statusChangeEvent);
          } catch (err) {
            if (!(err instanceof InvalidTransitionError)) throw err;
          }
          clearInputRequest(db, quest.id);
          collectedEvents.push(event);
          persistEvents();
          publishEvent?.(quest.id, event);
          continue;
        }

        if (event.type === 'combat') {
          try {
            const monsterType = classifyCombatEvent(db, event);
            if (monsterType) {
              const { monster, encounter } = recordEncounter(db, {
                questId: quest.id,
                monsterTypeId: monsterType.id,
                combatLogEntry: event.message,
              });
              const encounters = pendingEncountersByQuest.get(quest.id) ?? [];
              encounters.push(encounter.id);
              pendingEncountersByQuest.set(quest.id, encounters);
              const appearedEvent: AgentEvent = {
                type: 'monster_appeared',
                timestamp: new Date().toISOString(),
                encounterId: encounter.id,
                monsterId: monster.id,
                monsterName: monster.name,
                monsterTypeId: monsterType.id,
                spritePath: monsterType.spritePath,
                difficulty: monster.calibratedDifficulty,
              };
              collectedEvents.push(appearedEvent);
              publishEvent?.(quest.id, appearedEvent);

              // Lich aggregator: spawn lich after LICH_REPEAT_THRESHOLD same-type encounters
              if (monsterType.id !== 'lich_repeated_failure') {
                const typeCounts = typeCountsByQuest.get(quest.id) ?? new Map<string, number>();
                const typeCount = (typeCounts.get(monsterType.id) ?? 0) + 1;
                typeCounts.set(monsterType.id, typeCount);
                typeCountsByQuest.set(quest.id, typeCounts);

                if (typeCount === LICH_REPEAT_THRESHOLD) {
                  const lichType = getMonsterType(db, 'lich_repeated_failure');
                  if (lichType) {
                    const lichMsg = `The same ${monsterType.name} has struck ${LICH_REPEAT_THRESHOLD} times — a Lich emerges from the pattern!`;
                    const { monster: lich, encounter: lichEnc } = recordEncounter(db, {
                      questId: quest.id,
                      monsterTypeId: 'lich_repeated_failure',
                      combatLogEntry: lichMsg,
                    });
                    encounters.push(lichEnc.id);
                    pendingEncountersByQuest.set(quest.id, encounters);
                    const lichEvent: AgentEvent = {
                      type: 'monster_appeared',
                      timestamp: new Date().toISOString(),
                      encounterId: lichEnc.id,
                      monsterId: lich.id,
                      monsterName: lich.name,
                      monsterTypeId: lichType.id,
                      spritePath: lichType.spritePath,
                      difficulty: lich.calibratedDifficulty,
                    };
                    collectedEvents.push(lichEvent);
                    publishEvent?.(quest.id, lichEvent);
                  }
                }
              }
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            process.stderr.write(`[quest-runner] monster detection error for quest ${quest.id}: ${msg}\n`);
          }
        }

        collectedEvents.push(event);
        publishEvent?.(quest.id, event);

        if (event.type === 'progress') {
          const count = (progressCountByQuest.get(quest.id) ?? 0) + 1;
          progressCountByQuest.set(quest.id, count);
          if (count % PROGRESS_EVENTS_PER_SCENE === 0) {
            const transition = advanceQuestScene(db, quest.id);
            if (transition) {
              const sceneEvent: AgentEvent = {
                type: 'scene_change',
                timestamp: new Date().toISOString(),
                from: transition.from,
                to: transition.to,
              };
              collectedEvents.push(sceneEvent);
              publishEvent?.(quest.id, sceneEvent);
            }
          }
        }

        if (event.type === 'completed') {
          const pendingEncounters = pendingEncountersByQuest.get(quest.id) ?? [];
          for (const encounterId of pendingEncounters) {
            try {
              resolveEncounter(db, encounterId, 'victory');
              const resolvedEvent: AgentEvent = {
                type: 'monster_resolved',
                timestamp: new Date().toISOString(),
                encounterId,
                outcome: 'victory',
              };
              collectedEvents.push(resolvedEvent);
              publishEvent?.(quest.id, resolvedEvent);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              process.stderr.write(`[quest-runner] resolveEncounter error for ${encounterId}: ${msg}\n`);
            }
          }
          pendingEncountersByQuest.set(quest.id, []);

          let transition = advanceQuestScene(db, quest.id);
          while (transition) {
            const sceneEvent: AgentEvent = {
              type: 'scene_change',
              timestamp: new Date().toISOString(),
              from: transition.from,
              to: transition.to,
            };
            collectedEvents.push(sceneEvent);
            publishEvent?.(quest.id, sceneEvent);
            if (transition.to === 'quest-boss-room') break;
            transition = advanceQuestScene(db, quest.id);
          }
          try {
            transitionQuestStatus(db, quest.id, 'active', 'complete');
          } catch (err) {
            if (!(err instanceof InvalidTransitionError)) throw err;
          }
          persistEvents();
          endAgent(db, agent.id, 0);
          return;
        }
        if (event.type === 'failed') {
          const pendingEncounters = pendingEncountersByQuest.get(quest.id) ?? [];
          for (let i = 0; i < pendingEncounters.length; i++) {
            const encounterId = pendingEncounters[i];
            const outcome = i === pendingEncounters.length - 1 ? 'defeat' : 'escape';
            try {
              resolveEncounter(db, encounterId, outcome);
              const resolvedEvent: AgentEvent = {
                type: 'monster_resolved',
                timestamp: new Date().toISOString(),
                encounterId,
                outcome,
              };
              collectedEvents.push(resolvedEvent);
              publishEvent?.(quest.id, resolvedEvent);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              process.stderr.write(`[quest-runner] resolveEncounter error for ${encounterId}: ${msg}\n`);
            }
          }
          pendingEncountersByQuest.set(quest.id, []);

          const failureSummary = {
            reason: event.reason ?? '',
            recommendation: 'repost_with_clarification' as const,
          };
          const ts = new Date().toISOString();
          const result = db
            .prepare(
              "UPDATE quests SET status = 'failed', failure_summary_json = ?, updated_at = ? WHERE id = ? AND status = 'active'",
            )
            .run(JSON.stringify(failureSummary), ts, quest.id) as { changes: number };
          if (result.changes > 0) {
            persistEvents();
            endAgent(db, agent.id, 1);
            const channel = publishEvent ? { publishQuestEvent: publishEvent } : undefined;
            detectAndHandleFailure(quest.id, db, channel);
          }
          return;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[quest-runner] event loop error for quest ${quest.id}: ${msg}\n`);
      try {
        const failureSummary = { reason: `Adventurer's stream broke: ${msg}`, recommendation: 'retry' as const };
        const ts = new Date().toISOString();
        const result = db
          .prepare(
            "UPDATE quests SET status = 'failed', failure_summary_json = ?, updated_at = ? WHERE id = ? AND status = 'active'",
          )
          .run(JSON.stringify(failureSummary), ts, quest.id) as { changes: number };
        if (result.changes > 0) {
          persistEvents();
          endAgent(db, agent.id, null);
          publishEvent?.(quest.id, { type: 'failed', timestamp: ts, reason: msg });
          const channel = publishEvent ? { publishQuestEvent: publishEvent } : undefined;
          detectAndHandleFailure(quest.id, db, channel);
        }
      } catch {
        // DB unavailable (e.g. shutdown in progress); original error already logged above
      }
    } finally {
      activeHandles.delete(quest.id);
      progressCountByQuest.delete(quest.id);
      pendingEncountersByQuest.delete(quest.id);
      typeCountsByQuest.delete(quest.id);
    }
  })();

  return { agent, done };
}
