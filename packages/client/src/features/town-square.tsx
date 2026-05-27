import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Adventurer } from '@code-quests/shared';
import { api } from '../lib/api';
import { useFocusTrap } from '../lib/use-focus-trap';
import Roster from './guild/roster';
import RecruitModal from './guild/recruit-modal';
import QuestBoard from './quests/quest-board';

interface TownSquareProps {
  onClose: () => void;
}

export default function TownSquare({ onClose }: TownSquareProps) {
  const [showRecruit, setShowRecruit] = useState(false);
  const recruitBtnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useFocusTrap(onClose);

  const { data: rawData, isLoading, error } = useQuery({
    queryKey: ['adventurers'],
    queryFn: api.adventurers.list,
  });
  const data: Adventurer[] = (rawData as Adventurer[] | undefined) ?? [];

  // Snap focus on mount
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>(
      'button:not([disabled]), input:not([disabled])',
    );
    first?.focus();
  }, [panelRef]);

  // Re-focus recruit button after returning from recruit form
  useEffect(() => {
    if (!showRecruit) recruitBtnRef.current?.focus();
  }, [showRecruit]);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="town-square-title"
    >
      <div ref={panelRef} className="modal-panel town-square-panel">
        <h2 id="town-square-title" className="modal-title">
          Town Square
        </h2>
        <p className="modal-body town-square-tagline">
          Entry &amp; Recruiting — assemble your guild before the quest begins.
        </p>

        <section className="town-square-board-section" aria-labelledby="quest-board-heading">
          <h3 id="quest-board-heading" className="town-square-section-heading">
            Quest Board
          </h3>
          <QuestBoard />
        </section>

        <hr className="town-square-divider" />

        {showRecruit ? (
          <RecruitModal
            onCancel={() => setShowRecruit(false)}
            onSuccess={() => setShowRecruit(false)}
          />
        ) : (
          <div className="town-square-layout">
            <section className="town-square-roster" aria-label="Adventurer roster">
              <h3 className="town-square-roster-heading">Current Roster</h3>
              <Roster
                adventurers={data}
                isLoading={isLoading}
                error={error as Error | null}
              />
            </section>
            <aside className="town-square-sidebar">
              <p className="town-square-banner">Ready to grow your guild?</p>
              <button
                ref={recruitBtnRef}
                className="btn-primary town-square-recruit-btn"
                onClick={() => setShowRecruit(true)}
              >
                Recruit an Adventurer
              </button>
              <button className="btn-secondary" onClick={onClose}>
                Close
              </button>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
