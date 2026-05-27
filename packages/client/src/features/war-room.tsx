import { useEffect, useRef, useState } from 'react';
import { useFocusTrap } from '../lib/use-focus-trap';
import { useTownStore } from '../stores/town-store';
import DraftForm from './quests/draft-form';

export default function WarRoom() {
  const setActiveModal = useTownStore((s) => s.setActiveModal);
  const [showForm, setShowForm] = useState(true);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useFocusTrap(() => setActiveModal(null));

  useEffect(() => {
    if (!showForm) closeRef.current?.focus();
  }, [showForm]);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="war-room-title"
    >
      <div ref={panelRef} className="modal-panel war-room-panel">
        <h2 id="war-room-title" className="modal-title">
          War Room
        </h2>
        <p className="modal-body">
          Define your quest. Set the title, describe the mission, and lock in acceptance criteria.
        </p>

        {showForm ? (
          <DraftForm
            onSuccess={() => {
              setShowForm(false);
            }}
            onCancel={() => setActiveModal(null)}
          />
        ) : (
          <div className="war-room-success-actions">
            <p className="war-room-success-hint">Quest added to the board.</p>
            <div className="form-actions">
              <button
                className="btn-primary"
                onClick={() => setShowForm(true)}
              >
                Draft Another
              </button>
              <button ref={closeRef} className="btn-secondary" onClick={() => setActiveModal(null)}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
