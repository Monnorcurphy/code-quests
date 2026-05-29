import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFocusTrap } from '../../lib/use-focus-trap';
import { useTownStore } from '../../stores/town-store';
import ReturnedQuestList from './returned-quest-list';

type Tab = 'returned_to_town' | 'complete';

const VALID_TABS = new Set<Tab>(['returned_to_town', 'complete']);

function isValidTab(value: string | null): value is Tab {
  return value !== null && VALID_TABS.has(value as Tab);
}

export default function HallOfReturns() {
  const setActiveModal = useTownStore((s) => s.setActiveModal);
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab: Tab = isValidTab(rawTab) ? rawTab : 'returned_to_town';

  const panelRef = useFocusTrap(() => setActiveModal(null));
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const setTab = (t: Tab) => setSearchParams({ tab: t });

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hall-of-returns-title"
    >
      <div ref={panelRef} className="modal-panel hall-of-returns-panel">
        <div className="hall-of-returns-header">
          <h2 id="hall-of-returns-title" className="modal-title">
            Hall of Returns
          </h2>
          <button
            ref={closeRef}
            className="btn-secondary"
            onClick={() => setActiveModal(null)}
            aria-label="Close Hall of Returns"
          >
            Close
          </button>
        </div>

        <div className="hall-tabs" role="tablist" aria-label="Quest status">
          <button
            role="tab"
            id="hall-tab-returned"
            aria-controls="hall-panel-returned"
            aria-selected={tab === 'returned_to_town'}
            className={`hall-tab${tab === 'returned_to_town' ? ' hall-tab--active' : ''}`}
            onClick={() => setTab('returned_to_town')}
          >
            Returned
          </button>
          <button
            role="tab"
            id="hall-tab-completed"
            aria-controls="hall-panel-completed"
            aria-selected={tab === 'complete'}
            className={`hall-tab${tab === 'complete' ? ' hall-tab--active' : ''}`}
            onClick={() => setTab('complete')}
          >
            Completed
          </button>
        </div>

        <div
          id="hall-panel-returned"
          role="tabpanel"
          aria-labelledby="hall-tab-returned"
          hidden={tab !== 'returned_to_town'}
        >
          {tab === 'returned_to_town' && <ReturnedQuestList status="returned_to_town" />}
        </div>

        <div
          id="hall-panel-completed"
          role="tabpanel"
          aria-labelledby="hall-tab-completed"
          hidden={tab !== 'complete'}
        >
          {tab === 'complete' && <ReturnedQuestList status="complete" />}
        </div>
      </div>
    </div>
  );
}
