import { useEffect, useState } from 'react';
import { subscribeCue } from '../audio-cue-bus';
import { LOOPING_EVENTS } from '../audio-events';
import type { AudioEvent } from '../audio-events';

const MOOD_LABELS: Partial<Record<AudioEvent, string>> = {
  TOWN: 'Town · Calm',
  ROAD: 'On the Road',
  COMBAT: 'In Combat',
  BOSS: 'Boss Fight',
};

export default function SceneMoodIndicator() {
  const [mood, setMood] = useState<AudioEvent | null>(null);

  useEffect(() => {
    return subscribeCue((event) => {
      if (LOOPING_EVENTS.has(event)) {
        setMood(event);
      }
    });
  }, []);

  if (!mood) return null;

  return (
    <div
      key={mood}
      className="scene-mood-indicator"
      aria-hidden="true"
      data-testid="scene-mood-indicator"
    >
      {MOOD_LABELS[mood] ?? mood}
    </div>
  );
}
