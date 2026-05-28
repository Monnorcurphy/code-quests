export type AudioEvent =
  | 'TOWN'
  | 'ROAD'
  | 'COMBAT'
  | 'BOSS'
  | 'VICTORY_STINGER'
  | 'QUEST_COMPLETE'
  | 'QUEST_FAILED'
  | 'PAUSE_BELL';

export const LOOPING_EVENTS: Set<AudioEvent> = new Set(['TOWN', 'ROAD', 'COMBAT', 'BOSS']);
export const ONE_SHOT_EVENTS: Set<AudioEvent> = new Set([
  'VICTORY_STINGER',
  'QUEST_COMPLETE',
  'QUEST_FAILED',
  'PAUSE_BELL',
]);
