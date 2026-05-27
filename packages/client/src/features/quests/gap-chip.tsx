import type { SpecGap, SpecGapBuilding } from '@code-quests/shared';
import { useTownStore } from '../../stores/town-store';

const BUILDING_LABELS: Record<SpecGapBuilding, string> = {
  war_room: 'War Room',
  oracle: 'Oracle',
  library: 'Library',
  tavern: 'Tavern',
  armory: 'Armory',
  guild_hall: 'Guild Hall',
};

interface GapChipProps {
  gap: SpecGap;
}

export default function GapChip({ gap }: GapChipProps) {
  const goToBuilding = useTownStore((s) => s.goToBuilding);
  const isBlock = gap.severity === 'block';

  return (
    <div className={`gap-chip${isBlock ? ' gap-chip--block' : ' gap-chip--warn'}`}>
      <div className="gap-chip-content">
        {isBlock && (
          <span className="gap-chip-severity" aria-label="Blocking issue">
            BLOCKING
          </span>
        )}
        <span className="gap-chip-reason">{gap.reason}</span>
      </div>
      <button
        type="button"
        className="gap-chip-navigate"
        onClick={() => goToBuilding(gap.building)}
        aria-label={`${gap.reason} — Go to ${BUILDING_LABELS[gap.building]}`}
      >
        Go to {BUILDING_LABELS[gap.building]}
      </button>
    </div>
  );
}
