import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFocusTrap } from '../lib/use-focus-trap';
import { useTownStore } from '../stores/town-store';
import { api } from '../lib/api';

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export default function Library() {
  const setActiveModal = useTownStore((s) => s.setActiveModal);
  const selectedQuestId = useTownStore((s) => s.selectedQuestId);

  const panelRef = useFocusTrap(() => setActiveModal(null));

  const { data: quest, isLoading, error } = useQuery({
    queryKey: ['quest', selectedQuestId],
    queryFn: () => api.quests.get(selectedQuestId!),
    enabled: selectedQuestId !== null,
  });

  const [context, setContext] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (newContext: string) =>
      api.quests.patch(selectedQuestId!, { context: newContext }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['quest', selectedQuestId] });
      void queryClient.invalidateQueries({ queryKey: ['quests'] });
    },
  });

  useEffect(() => {
    if (quest && !initialized) {
      setContext(quest.context ?? '');
      setInitialized(true);
    }
  }, [quest, initialized]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled])',
    );
    first?.focus();
  }, [panelRef]);

  async function handleSave() {
    setSaveStatus('saving');
    setSaveError('');
    try {
      await mutation.mutateAsync(context);
      setSaveStatus('success');
      timerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e) {
      setSaveStatus('error');
      setSaveError(e instanceof Error ? e.message : 'Failed to save. Please try again.');
    }
  }

  const isSaving = saveStatus === 'saving';

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="library-title">
      <div ref={panelRef} className="modal-panel library-panel">
        <h2 id="library-title" className="modal-title">
          Library — Quest Context
        </h2>

        {!selectedQuestId ? (
          <>
            <p className="modal-body">No quest selected. Select a quest from the Quest Board first.</p>
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setActiveModal(null)}>
                Close
              </button>
            </div>
          </>
        ) : isLoading ? (
          <p className="building-loading" aria-live="polite" aria-busy="true">
            Loading quest…
          </p>
        ) : error || !quest ? (
          <p className="building-load-error" role="alert">
            Could not load quest. Make sure the server is running.
          </p>
        ) : (
          <>
            <p className="building-quest-name">{quest.title}</p>
            <p className="modal-body">
              Gather background knowledge and relevant context for this quest.
            </p>

            <div className="form-field">
              <label htmlFor="library-context">Context</label>
              <textarea
                id="library-context"
                className="form-textarea library-textarea"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                disabled={isSaving}
                rows={8}
                aria-label="Quest context"
              />
            </div>

            <div aria-live="polite" aria-atomic="true" className="building-status">
              {saveStatus === 'success' && (
                <p className="building-save-success" role="status">
                  Context saved!
                </p>
              )}
            </div>

            {saveStatus === 'error' && (
              <p className="building-save-error" role="alert">
                {saveError}
              </p>
            )}

            <div className="form-actions">
              <button
                className="btn-primary"
                onClick={() => { void handleSave(); }}
                disabled={isSaving}
                aria-busy={isSaving}
              >
                {isSaving ? 'Saving…' : 'Save Context'}
              </button>
              <button className="btn-secondary" onClick={() => setActiveModal('draft')}>
                ← Back to War Room
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
