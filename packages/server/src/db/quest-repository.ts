import type Database from 'better-sqlite3';
import { InputRequestSchema, UserBlockerSchema } from '@code-quests/shared';
import type { InputRequest, UserBlocker } from '@code-quests/shared';

export function setInputRequest(db: Database.Database, questId: string, request: InputRequest): void {
  const now = new Date().toISOString();
  db.prepare(
    'UPDATE quests SET input_request_json = ?, updated_at = ? WHERE id = ?',
  ).run(JSON.stringify(request), now, questId);
}

export function clearInputRequest(db: Database.Database, questId: string): void {
  const now = new Date().toISOString();
  db.prepare(
    'UPDATE quests SET input_request_json = NULL, updated_at = ? WHERE id = ?',
  ).run(now, questId);
}

export function setUserBlocker(db: Database.Database, questId: string, blocker: UserBlocker | null): void {
  const now = new Date().toISOString();
  db.prepare(
    'UPDATE quests SET user_blocker_json = ?, updated_at = ? WHERE id = ?',
  ).run(blocker !== null ? JSON.stringify(blocker) : null, now, questId);
}

export function getInputRequest(db: Database.Database, questId: string): InputRequest | null {
  const row = db.prepare('SELECT input_request_json FROM quests WHERE id = ?').get(questId) as
    | { input_request_json: string | null }
    | undefined;
  if (!row || row.input_request_json === null) return null;
  return InputRequestSchema.parse(JSON.parse(row.input_request_json));
}

export function getUserBlocker(db: Database.Database, questId: string): UserBlocker | null {
  const row = db.prepare('SELECT user_blocker_json FROM quests WHERE id = ?').get(questId) as
    | { user_blocker_json: string | null }
    | undefined;
  if (!row || row.user_blocker_json === null) return null;
  return UserBlockerSchema.parse(JSON.parse(row.user_blocker_json));
}
