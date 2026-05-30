import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Adventurer } from '@code-quests/shared';
import { api } from '../../lib/api';
import { useFocusTrap } from '../../lib/use-focus-trap';
import { useTownStore } from '../../stores/town-store';
import Roster from './roster';
import RecruitModal from './recruit-modal';
import WardrobePanel from './wardrobe-panel';

export default function GuildHall() {
  const setActiveModal = useTownStore((s) => s.setActiveModal);
  const [showRecruit, setShowRecruit] = useState(false);
  const [wardrobeFor, setWardrobeFor] = useState<Adventurer | null>(null);
  const recruitBtnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useFocusTrap(() => setActiveModal(null));

  const { data: rawData, isLoading, error } = useQuery({
    queryKey: ['adventurers'],
    queryFn: api.adventurers.list,
  });
  const data: Adventurer[] = (rawData as Adventurer[] | undefined) ?? [];

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>(
      'button:not([disabled]), input:not([disabled])',
    );
    first?.focus();
  }, [panelRef]);

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
        ) : wardrobeFor ? (
          <WardrobePanel
            adventurer={wardrobeFor}
            onClose={() => setWardrobeFor(null)}
          />
        ) : (
          <>
            <Roster
              adventurers={data}
              isLoading={isLoading}
              error={error as Error | null}
              onStyle={(adv) => setWardrobeFor(adv)}
            />
            <div className="guild-hall-actions">
              <button
                ref={recruitBtnRef}
                className="btn-primary"
                onClick={() => setShowRecruit(true)}
              >
                Recruit Adventurer
              </button>
              <button className="btn-secondary" onClick={() => setActiveModal(null)}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
