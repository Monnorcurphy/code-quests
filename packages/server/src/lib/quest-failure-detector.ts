import type Database from 'better-sqlite3';
import type { AgentEvent } from '@code-quests/shared';
import { returnQuestToTown, QuestReturnError } from '../services/quest-return';

type Channel = { publishQuestEvent: (questId: string, event: AgentEvent) => void };

export function detectAndHandleFailure(
  questId: string,
  db: Database.Database,
  channel?: Channel,
): void {
  const row = db
    .prepare('SELECT status FROM quests WHERE id = ?')
    .get(questId) as { status: string } | undefined;

  if (row?.status !== 'failed') return;

  try {
    returnQuestToTown(questId, db, channel);
  } catch (err) {
    if (err instanceof QuestReturnError) {
      process.stderr.write(`[quest-failure-detector] ${err.message}\n`);
    } else {
      throw err;
    }
  }
}
