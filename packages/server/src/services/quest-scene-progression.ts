import type Database from 'better-sqlite3';
import { QuestSceneKeySchema } from '@code-quests/shared';
import type { QuestSceneKey } from '@code-quests/shared';

export const QUEST_SCENE_ORDER: QuestSceneKey[] = [
  'quest-forest',
  'quest-cave',
  'quest-dungeon',
  'quest-boss-room',
];

export function nextScene(current: QuestSceneKey): QuestSceneKey | null {
  const idx = QUEST_SCENE_ORDER.indexOf(current);
  if (idx === -1 || idx === QUEST_SCENE_ORDER.length - 1) return null;
  return QUEST_SCENE_ORDER[idx + 1] ?? null;
}

export function advanceQuestScene(
  db: Database.Database,
  questId: string,
): { from: QuestSceneKey; to: QuestSceneKey } | null {
  const row = db
    .prepare('SELECT current_scene FROM quests WHERE id = ?')
    .get(questId) as { current_scene: string } | undefined;
  if (!row) return null;

  const current = QuestSceneKeySchema.parse(row.current_scene);
  const next = nextScene(current);
  if (next === null) return null;

  const now = new Date().toISOString();
  const result = db
    .prepare('UPDATE quests SET current_scene = ?, updated_at = ? WHERE id = ? AND current_scene = ?')
    .run(next, now, questId, current) as { changes: number };

  if (result.changes === 0) return null;

  return { from: current, to: next };
}

export function getCurrentScene(db: Database.Database, questId: string): QuestSceneKey {
  const row = db
    .prepare('SELECT current_scene FROM quests WHERE id = ?')
    .get(questId) as { current_scene: string } | undefined;
  if (!row) throw new Error(`Quest ${questId} not found`);
  return QuestSceneKeySchema.parse(row.current_scene);
}
