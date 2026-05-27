import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Adventurer } from '@code-quests/shared';
import { api } from '../../lib/api';
import { useFocusTrap } from '../../lib/use-focus-trap';
import Roster from './roster';
import RecruitModal from './recruit-modal';

interface GuildHallProps {
  onClose: () => void;
}

export default function GuildHall({ onClose }: GuildHallProps) {
  const [showRecruit, setShowRecruit] = useState(false);
  const recruitBtnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useFocusTrap(onClose);

  const { data: rawData, isLoading, error } = useQuery({
    queryKey: ['adventurers'],
    queryFn: api.adventurers.list,
  });
  const data: Adventurer[] = (rawData as Adventurer[] | undefined) ?? [];

  // Snap focus to first button on mount
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>(
      'button:not([disabled]), input:not([disabled])',
    );
    first?.focus();
  }, [panelRef]);

  // Re-focus the Recruit button after returning from recruit form
  useEffect(() => {
    if (!showRecruit) recruitBtnRef.current?.focus();
  }, [showRecruit]);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guild-hall-title"
    >
      <div ref={panelRef} className="modal-panel guild-hall-panel">
        <h2 id="guild-hall-title" className="modal-title">
          Guild Hall
        </h2>

        {showRecruit ? (
          <RecruitModal
            onCancel={() => setShowRecruit(false)}
            onSuccess={() => setShowRecruit(false)}
          />
        ) : (
          <>
            <Roster
              adventurers={data}
              isLoading={isLoading}
              error={error as Error | null}
            />
            <div className="guild-hall-actions">
              <button
                ref={recruitBtnRef}
                className="btn-primary"
                onClick={() => setShowRecruit(true)}
              >
                Recruit Adventurer
              </button>
              <button className="btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
