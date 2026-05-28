import { useEffect, useRef, useState } from 'react';
import { useFocusTrap } from '../lib/use-focus-trap';
import { AudioSettings } from './audio-settings';

const STORAGE_KEY = 'code-quests:reduced-motion';

export function applyReducedMotionPreference(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'true') {
    document.documentElement.setAttribute('data-reduced-motion', 'true');
  }
}

function applyValue(value: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(value));
  if (value) {
    document.documentElement.setAttribute('data-reduced-motion', 'true');
  } else {
    document.documentElement.removeAttribute('data-reduced-motion');
  }
}

interface SettingsPanelProps {
  onClose: () => void;
}

function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [reducedMotion, setReducedMotion] = useState(
    () => localStorage.getItem(STORAGE_KEY) === 'true',
  );
  const panelRef = useFocusTrap(onClose);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  function handleToggle() {
    const next = !reducedMotion;
    setReducedMotion(next);
    applyValue(next);
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      style={{ zIndex: 200 }}
    >
      <div ref={panelRef} className="modal-panel settings-panel">
        <h2 id="settings-title" className="modal-title">
          Settings
        </h2>
        <div className="settings-row">
          <div className="settings-row-text">
            <span className="settings-row-label">Reduce motion</span>
            <span className="settings-row-hint">Disables scene fade transitions</span>
          </div>
          <label className="settings-toggle-wrap" htmlFor="reduced-motion-toggle">
            <input
              id="reduced-motion-toggle"
              type="checkbox"
              className="settings-toggle-input"
              checked={reducedMotion}
              onChange={handleToggle}
              aria-label="Reduce motion"
            />
            <span className="settings-toggle-track" aria-hidden="true">
              {reducedMotion ? 'On' : 'Off'}
            </span>
          </label>
        </div>
        <AudioSettings />
        <div className="form-actions">
          <button ref={closeRef} className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="settings-hud-btn"
        aria-label="Open settings"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
      >
        ⚙
      </button>
      {isOpen && <SettingsPanel onClose={() => setIsOpen(false)} />}
    </>
  );
}
