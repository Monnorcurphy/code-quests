import { useRef, useEffect } from 'react';
import { useFocusTrap } from '../lib/use-focus-trap';
import { useTownStore } from '../stores/town-store';

interface HelpPanelProps {
  onClose: () => void;
}

export default function HelpPanel({ onClose }: HelpPanelProps) {
  const panelRef = useFocusTrap(onClose);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
    >
      <div ref={panelRef} className="modal-panel" style={{ maxWidth: 640 }}>
        <h2 id="help-title" className="modal-title">
          Elder Hawthorne&apos;s Guide
        </h2>
        <p
          style={{
            fontStyle: 'italic',
            color: '#5a3818',
            marginTop: 0,
            marginBottom: 16,
          }}
        >
          &ldquo;Welcome, adventurer. Allow me to show you the lay of the land.&rdquo;
        </p>

        <section style={{ marginBottom: 14 }}>
          <h3 style={{ color: '#7a1818', marginBottom: 6 }}>The Town</h3>
          <p style={{ marginTop: 0 }}>
            Seven halls surround the square. Click any building atop the screen —
            or click a door, or walk to it with the arrow keys and press Enter.
          </p>
          <ul style={{ marginTop: 4, paddingLeft: 20, lineHeight: 1.6 }}>
            <li>
              <strong>⚔ War Room</strong> — Draft a new quest: title, mission,
              acceptance criteria.
            </li>
            <li>
              <strong>✦ Oracle</strong> — Define acceptance criteria for a
              selected quest.
            </li>
            <li>
              <strong>📜 Library</strong> — Context, skills, and the Bestiary
              (all monsters encountered).
            </li>
            <li>
              <strong>🍺 Tavern</strong> — Edge cases &amp; weird scenarios
              your adventurer may hit.
            </li>
            <li>
              <strong>🛡 Armory</strong> — Equipment loadout: skills, tools,
              MCP servers your adventurer carries.
            </li>
            <li>
              <strong>🏛 Guild Hall</strong> — Your roster of recruited
              adventurers.
            </li>
            <li>
              <strong>⚰ Hall of Returns</strong> — Returned and completed
              quests. Review what happened.
            </li>
          </ul>
        </section>

        <section style={{ marginBottom: 14 }}>
          <h3 style={{ color: '#7a1818', marginBottom: 6 }}>The Quest Flow</h3>
          <ol style={{ marginTop: 4, paddingLeft: 20, lineHeight: 1.6 }}>
            <li>Click the <strong>Recruit Banner</strong> → recruit an adventurer.</li>
            <li>
              Click the <strong>Quest Board</strong> or visit the{' '}
              <strong>War Room</strong> → draft a quest.
            </li>
            <li>
              From the Quest Board, choose an adventurer and{' '}
              <strong>Dispatch</strong>.
            </li>
            <li>
              The quest plays out at <code>/quest/&lt;id&gt;</code>. Watch the
              combat log. Click <strong>Seek counsel</strong> to pause and ask
              the adventurer something. Click <strong>Return to Town</strong>{' '}
              to leave any time.
            </li>
            <li>
              Quest completes (or fails) → records in the{' '}
              <strong>Hall of Returns</strong>.
            </li>
          </ol>
        </section>

        <section style={{ marginBottom: 14 }}>
          <h3 style={{ color: '#7a1818', marginBottom: 6 }}>Controls</h3>
          <ul style={{ marginTop: 4, paddingLeft: 20, lineHeight: 1.6 }}>
            <li>
              <strong>←/→ or A/D</strong> — walk
            </li>
            <li>
              <strong>Enter / Space</strong> — interact (when near a sign or
              door)
            </li>
            <li>
              <strong>Click anywhere</strong> — first click also enables music
              (browser autoplay policy)
            </li>
            <li>
              <strong>Tab</strong> — cycle nearby interactives
            </li>
            <li>
              <strong>Esc</strong> — close any dialog
            </li>
          </ul>
        </section>

        <section style={{ marginBottom: 14 }}>
          <h3 style={{ color: '#7a1818', marginBottom: 6 }}>Real vs. Offline Agents</h3>
          <p style={{ marginTop: 0 }}>
            By default quests use a stub adapter that asks placeholder
            questions. To run with a real Claude agent that actually works on
            your repo, start the server with{' '}
            <code>CODE_QUESTS_USE_REAL_AGENT=1</code> and the{' '}
            <code>claude</code> binary on your PATH. Add{' '}
            <code>ANTHROPIC_API_KEY</code> for Haiku-powered AC scoring.
          </p>
        </section>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            ref={closeRef}
            type="button"
            className="btn-primary"
            onClick={onClose}
          >
            Onward
          </button>
        </div>
      </div>
    </div>
  );
}

export function HelpPanelContainer() {
  const setActiveModal = useTownStore((s) => s.setActiveModal);
  return <HelpPanel onClose={() => setActiveModal(null)} />;
}
