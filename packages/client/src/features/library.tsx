import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useFocusTrap } from '../lib/use-focus-trap';
import { useTownStore } from '../stores/town-store';
import { api } from '../lib/api';
import Bestiary from './library/bestiary';
import SkillsTab from './library/skills-tab';

type LibraryTab = 'bestiary' | 'skills';

export default function Library() {
  const setActiveModal = useTownStore((s) => s.setActiveModal);
  const markLibraryOpened = useTownStore((s) => s.markLibraryOpened);
  const libraryInitialTab = useTownStore((s) => s.libraryInitialTab);
  const setLibraryInitialTab = useTownStore((s) => s.setLibraryInitialTab);
  const panelRef = useFocusTrap(() => setActiveModal(null));
  const [searchParams] = useSearchParams();
  const bestiaryTypeFilter = searchParams.get('typeId');

  const { data: monsterCount } = useQuery({
    queryKey: ['monsters-count'],
    queryFn: () => api.monsters.list({ scope: 'project' }).then((m) => m.length),
    staleTime: 30_000,
  });

  const { data: allSkills } = useQuery({
    queryKey: ['skills'],
    queryFn: () => api.skills.list(),
    staleTime: 30_000,
  });
  const candidateCount = allSkills?.filter((s) => s.status === 'candidate').length ?? 0;
  const [activeTab, setActiveTab] = useState<LibraryTab>(libraryInitialTab);

  const mountedRef = useRef(false);
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    markLibraryOpened();
    setLibraryInitialTab('bestiary');
  }, [markLibraryOpened, setLibraryInitialTab]);

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
        <div className="library-header">
          <h2 id="library-title" className="modal-title">Library</h2>
          {monsterCount !== undefined && monsterCount > 0 && (
            <span className="library-bestiary-badge" aria-label={`Bestiary unlocked — ${monsterCount} monster${monsterCount === 1 ? '' : 's'} logged`}>
              Bestiary unlocked — {monsterCount} monster{monsterCount === 1 ? '' : 's'} logged
            </span>
          )}
        </div>

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
            aria-label={candidateCount > 0
              ? `Skills — ${candidateCount} candidate${candidateCount === 1 ? '' : 's'} pending`
              : 'Skills'}
          >
            Skills
            {candidateCount > 0 && (
              <span className="skills-tab-dot" aria-hidden="true" />
            )}
          </button>
        </div>

        <div
          role="tabpanel"
          id="lib-panel-bestiary"
          aria-labelledby="lib-tab-bestiary"
          hidden={activeTab !== 'bestiary'}
          className="library-tabpanel"
        >
          <Bestiary initialTypeFilter={bestiaryTypeFilter} />
        </div>

        <div
          role="tabpanel"
          id="lib-panel-skills"
          aria-labelledby="lib-tab-skills"
          hidden={activeTab !== 'skills'}
          className="library-tabpanel"
        >
          <SkillsTab />
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
