import { useEffect, useRef, useState } from 'react';

const BUILDINGS = [
  { id: 'town-square', name: 'Town Square', role: 'Entry & Recruiting' },
  { id: 'war-room', name: 'War Room', role: 'Quest Description' },
  { id: 'oracle', name: 'Oracle', role: 'Acceptance Criteria' },
  { id: 'library', name: 'Library', role: 'Context' },
  { id: 'tavern', name: 'Tavern', role: 'Edge Cases' },
  { id: 'armory', name: 'Armory', role: 'Equipment' },
  { id: 'guild-hall', name: 'Guild Hall', role: 'Adventurer' },
  { id: 'hall-of-returns', name: 'Hall of Returns', role: 'Post-Quest' },
] as const;

type BuildingId = (typeof BUILDINGS)[number]['id'];

interface BuildingModalProps {
  building: (typeof BUILDINGS)[number];
  onClose: () => void;
}

function BuildingModal({ building, onClose }: BuildingModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Mount-only: snap focus once + install keydown (Escape to close, Tab to trap)
  useEffect(() => {
    closeRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;
        const focusable = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'button, [href], input, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !(el as HTMLButtonElement).disabled);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div ref={panelRef} className="modal-panel">
        <h2 id="modal-title" className="modal-title">
          {building.name}
        </h2>
        <p className="modal-body">Coming in Phase 2 — Phaser scene</p>
        <button ref={closeRef} className="modal-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export default function Town() {
  const [openBuilding, setOpenBuilding] = useState<BuildingId | null>(null);
  const triggerRefs = useRef<Map<BuildingId, HTMLButtonElement>>(new Map());

  const activeBuilding = BUILDINGS.find((b) => b.id === openBuilding) ?? null;

  function handleOpen(id: BuildingId) {
    setOpenBuilding(id);
  }

  function handleClose() {
    const triggerId = openBuilding;
    setOpenBuilding(null);
    if (triggerId) {
      triggerRefs.current.get(triggerId)?.focus();
    }
  }

  return (
    <main className="town-page">
      <header className="town-header">
        <h1 className="town-title">The Town</h1>
        <p className="town-subtitle">
          Select a building to begin your quest preparation.
        </p>
      </header>

      <ul
        className="building-grid"
        role="list"
        aria-hidden={activeBuilding !== null ? 'true' : undefined}
      >
        {BUILDINGS.map((building) => (
          <li key={building.id}>
            <button
              ref={(el) => {
                if (el) triggerRefs.current.set(building.id, el);
              }}
              className="building-btn"
              aria-label={`Enter ${building.name} — ${building.role}`}
              onClick={() => handleOpen(building.id)}
            >
              <span className="building-name">{building.name}</span>
              <span className="building-role">{building.role}</span>
            </button>
          </li>
        ))}
      </ul>

      {activeBuilding && (
        <BuildingModal building={activeBuilding} onClose={handleClose} />
      )}
    </main>
  );
}
