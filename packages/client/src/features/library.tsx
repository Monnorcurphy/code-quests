import { useEffect, useRef, useState } from 'react';
import { useFocusTrap } from '../lib/use-focus-trap';
import { useTownStore } from '../stores/town-store';
import Bestiary from './library/bestiary';

type LibraryTab = 'bestiary' | 'skills';

export default function Library() {
  const setActiveModal = useTownStore((s) => s.setActiveModal);
  const panelRef = useFocusTrap(() => setActiveModal(null));
  const [activeTab, setActiveTab] = useState<LibraryTab>('bestiary');

  const focusedRef = useRef(false);
  useEffect(() => {
    if (focusedRef.current) return;
    const panel = panelRef.current;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled])',
    );
    if (first) { first.focus(); focusedRef.current = true; }
  }, [panelRef]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="library-title">
      <div ref={panelRef} className="modal-panel library-panel">
        <h2 id="library-title" className="modal-title">Library</h2>

        <div role="tablist" aria-label="Library sections" className="library-tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'bestiary'}
            aria-controls="lib-panel-bestiary"
            id="lib-tab-bestiary"
            className={`library-tab${activeTab === 'bestiary' ? ' library-tab--active' : ''}`}
            onClick={() => setActiveTab('bestiary')}
          >
            Bestiary
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'skills'}
            aria-controls="lib-panel-skills"
            id="lib-tab-skills"
            className={`library-tab${activeTab === 'skills' ? ' library-tab--active' : ''}`}
            onClick={() => setActiveTab('skills')}
          >
            Skills
          </button>
        </div>

        <div
          role="tabpanel"
          id="lib-panel-bestiary"
          aria-labelledby="lib-tab-bestiary"
          hidden={activeTab !== 'bestiary'}
          className="library-tabpanel"
        >
          <Bestiary />
        </div>

        <div
          role="tabpanel"
          id="lib-panel-skills"
          aria-labelledby="lib-tab-skills"
          hidden={activeTab !== 'skills'}
          className="library-tabpanel"
        >
          <p className="library-placeholder">Skills catalogue coming in Phase 10.</p>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => setActiveModal(null)}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
