import type Database from 'better-sqlite3';

export class InvalidTransitionError extends Error {
  constructor(
    public readonly questId: string,
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`Quest ${questId}: cannot transition from '${from}' to '${to}' — quest may already be in a different state`);
    this.name = 'InvalidTransitionError';
  }
}

export function transitionQuestStatus(
  db: Database.Database,
  questId: string,
  from: string,
  to: string,
): void {
  const now = new Date().toISOString();
  const result = db
    .prepare('UPDATE quests SET status = ?, updated_at = ? WHERE id = ? AND status = ?')
    .run(to, now, questId, from) as { changes: number };
  if (result.changes === 0) {
    throw new InvalidTransitionError(questId, from, to);
  }
}
