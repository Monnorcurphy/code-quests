import type { AudioEvent } from './audio-events';

export const AUDIO_MANIFEST: Record<AudioEvent, string> = {
  TOWN: '/audio/town-theme.wav',
  ROAD: '/audio/road-theme.wav',
  COMBAT: '/audio/combat-theme.wav',
  BOSS: '/audio/boss-theme.wav',
  VICTORY_STINGER: '/audio/victory-stinger.wav',
  QUEST_COMPLETE: '/audio/quest-complete.wav',
  QUEST_FAILED: '/audio/quest-failed.wav',
  PAUSE_BELL: '/audio/bell.wav',
};
