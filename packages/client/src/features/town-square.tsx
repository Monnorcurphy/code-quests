import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Adventurer, Quest } from '@code-quests/shared';
import { api } from '../lib/api';
import { subscribe } from '../lib/quest-socket';
import { useFocusTrap } from '../lib/use-focus-trap';
import { useTownStore } from '../stores/town-store';
import Roster from './guild/roster';
import RecruitModal from './guild/recruit-modal';
import QuestBoard from './quests/quest-board';

function ActiveQuestPeekItem({
  quest,
  adventurers,
}: {
  quest: Quest;
  adventurers: Adventurer[];
}) {
  const [lastEvent, setLastEvent] = useState('Quest in progress');
  const setSelectedQuestId = useTownStore((s) => s.setSelectedQuestId);
  const setActiveModal = useTownStore((s) => s.setActiveModal);
  const adventurer = adventurers.find((a) => a.id === quest.adventurerId) ?? null;

  useEffect(() => {
    return subscribe(quest.id, (event) => {
      if (event.type === 'progress') setLastEvent(event.message);
      else if (event.type === 'combat') setLastEvent(`⚔ ${event.message}`);
      else if (event.type === 'completed') setLastEvent('Quest complete!');
      else if (event.type === 'failed') setLastEvent('Quest failed.');
    });
  }, [quest.id]);

  function handleClick(): void {
    setSelectedQuestId(quest.id);
    setActiveModal('draft');
  }

  return (
    <li className="active-quest-peek-item">
      <div className="active-quest-peek-info">
        <span className="active-quest-peek-title">{quest.title}</span>
        {adventurer && (
          <span className="active-quest-peek-adventurer">{adventurer.name}</span>
        )}
        <span className="active-quest-peek-event">{lastEvent}</span>
      </div>
      <button
        type="button"
        className="active-quest-peek-link"
        onClick={handleClick}
        aria-label={`View quest: ${quest.title}`}
      >
        View
      </button>
    </li>
  );
}

function ActiveQuestsPeek({ adventurers }: { adventurers: Adventurer[] }) {
  const { data: rawQuests } = useQuery({
    queryKey: ['quests'],
    queryFn: api.quests.list,
  });
  const quests: Quest[] = (rawQuests as Quest[] | undefined) ?? [];
  const activeQuests = quests.filter((q) => q.status === 'active');

  if (activeQuests.length === 0) return null;

  return (
    <div className="active-quest-peek" aria-label="Currently questing">
      <h3 className="active-quest-peek-heading">Currently Questing</h3>
      <ul className="active-quest-peek-list" role="list">
        {activeQuests.map((quest) => (
          <ActiveQuestPeekItem key={quest.id} quest={quest} adventurers={adventurers} />
        ))}
      </ul>
    </div>
  );
}

function QuestBoardPanel({ onClose, onRecruit }: { onClose: () => void; onRecruit: () => void }) {
  const recruitBtnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useFocusTrap(onClose);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>(
      'button:not([disabled]), input:not([disabled])',
    );
    first?.focus();
  }, [panelRef]);

  const { data: rawData, isLoading, error } = useQuery({
    queryKey: ['adventurers'],
    queryFn: api.adventurers.list,
  });
  const adventurers: Adventurer[] = (rawData as Adventurer[] | undefined) ?? [];

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

        <ActiveQuestsPeek adventurers={adventurers} />

        <section className="town-square-board-section" aria-labelledby="quest-board-heading">
          <h3 id="quest-board-heading" className="town-square-section-heading">
            Quest Board
          </h3>
          <QuestBoard />
        </section>

        <hr className="town-square-divider" />

        <div className="town-square-layout">
          <section className="town-square-roster" aria-label="Adventurer roster">
            <h3 className="town-square-roster-heading">Current Roster</h3>
            <Roster
              adventurers={adventurers}
              isLoading={isLoading}
              error={error as Error | null}
            />
          </section>
          <aside className="town-square-sidebar">
            <p className="town-square-banner">Ready to grow your guild?</p>
            <button
              ref={recruitBtnRef}
              className="btn-primary town-square-recruit-btn"
              onClick={onRecruit}
            >
              Recruit an Adventurer
            </button>
            <button className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}

function RecruitPanel({ onBack }: { onBack: () => void }) {
  const panelRef = useFocusTrap(onBack);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recruit-panel-title"
    >
      <div ref={panelRef} className="modal-panel">
        <h2 id="recruit-panel-title" className="modal-title">
          Recruit an Adventurer
        </h2>
        <RecruitModal onCancel={onBack} onSuccess={onBack} />
      </div>
    </div>
  );
}

export default function TownSquare() {
  const activeModal = useTownStore((s) => s.activeModal);
  const setActiveModal = useTownStore((s) => s.setActiveModal);

  if (activeModal === 'quest-board') {
    return (
      <QuestBoardPanel
        onClose={() => setActiveModal(null)}
        onRecruit={() => setActiveModal('recruit')}
      />
    );
  }

  if (activeModal === 'recruit') {
    return <RecruitPanel onBack={() => setActiveModal('quest-board')} />;
  }

  return null;
}
