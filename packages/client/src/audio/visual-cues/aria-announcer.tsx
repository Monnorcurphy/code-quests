import { useEffect, useState } from 'react';
import { subscribeCue } from '../audio-cue-bus';
import type { AudioEvent } from '../audio-events';

const ANNOUNCEMENTS: Record<AudioEvent, string> = {
  TOWN: 'Town theme playing',
  ROAD: 'Travelling — road theme playing',
  COMBAT: 'Combat begun',
  BOSS: 'Boss encounter — boss theme playing',
  VICTORY_STINGER: 'Monster defeated',
  QUEST_COMPLETE: 'Quest complete',
  QUEST_FAILED: 'Quest failed — returned to town',
  PAUSE_BELL: 'Bell — input requested',
};

export default function AriaAnnouncer() {
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    return subscribeCue((event) => {
      // QUEST_FAILED is announced assertively by StingerToast; skip here to avoid duplicate
      if (event === 'QUEST_FAILED') return;
      setAnnouncement(ANNOUNCEMENTS[event]);
    });
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      data-testid="aria-announcer"
    >
      {announcement}
    </div>
  );
}
