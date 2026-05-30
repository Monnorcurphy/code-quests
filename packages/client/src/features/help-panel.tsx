import { useRef, useEffect } from 'react';
import { useFocusTrap } from '../lib/use-focus-trap';
import { useTownStore } from '../stores/town-store';
import { PlayerWardrobeSection } from './player-wardrobe-section';

interface HelpPanelProps {
  onClose: () => void;
}

const C = (s: string) => (
  <code style={{ background: '#f5ecd6', padding: '1px 4px', borderRadius: 3, fontSize: '0.85em' }}>
    {s}
  </code>
);

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
      <div ref={panelRef} className="modal-panel" style={{ maxWidth: 680 }}>
        <h2 id="help-title" className="modal-title">
          Elder Hawthorne
        </h2>
        <p style={{ margin: '2px 0 16px', color: '#7a4a18', fontWeight: 600 }}>
          Town Elder
        </p>
        <p
          style={{
            fontStyle: 'italic',
            color: '#5a3818',
            marginTop: 0,
            marginBottom: 16,
            padding: '8px 12px',
            background: '#f5ecd6',
            borderLeft: '3px solid #8a6a3a',
          }}
        >
          *walks over with a warm smile, hands clasped behind his back.* &ldquo;Ah, a
          new face. Come, come — let me show you about. I won&apos;t keep you long. The
          realm waits.&rdquo;
        </p>

        <section style={{ marginBottom: 14 }}>
          <h3 style={{ color: '#7a1818', marginBottom: 6 }}>The seven halls</h3>
          <p style={{ marginTop: 4, lineHeight: 1.6 }}>
            Seven halls ring the square. Walk them in turn and the realm will make
            sense. The <strong>War Room</strong> is where you&apos;ll draft a quest —
            one well-shaped task to send your adventurer upon. Commander Tyra holds
            briefings there. The <strong>Oracle</strong> is Seer Caelis&apos;s chamber;
            she&apos;ll help you write success in words she can verify on return.
          </p>
          <p style={{ marginTop: 8, lineHeight: 1.6 }}>
            The <strong>Library</strong> holds the lore of the realm — the rules your
            adventurer must know, and the bestiary of every monster they&apos;ve
            faced. Sage Mireldine keeps it. The <strong>Tavern</strong> is for warning
            adventurers about strange paths — edge cases, the locals call them.
            Innkeep Rorek has stories enough.
          </p>
          <p style={{ marginTop: 8, lineHeight: 1.6 }}>
            The <strong>Armory</strong> is Smith Bran&apos;s domain; he&apos;ll equip
            your adventurer with the right tools for the work. The{' '}
            <strong>Guild Hall</strong> is the roster — your adventurers are kept
            there. Master Eldra watches over them. And the{' '}
            <strong>Hall of Returns</strong> is where every finished quest comes home.
            Keeper Vorn lays them gently to rest. Read them before you draft the
            next.
          </p>
        </section>

        <section style={{ marginBottom: 14 }}>
          <h3 style={{ color: '#7a1818', marginBottom: 6 }}>How a quest takes shape</h3>
          <p style={{ marginTop: 4, lineHeight: 1.6 }}>
            It begins simply. You step to the Recruit Banner and call an adventurer
            into your guild. You then visit the War Room — or knock on the Quest Board
            in the square — and draft a quest: the brief that will guide them. From
            there, you choose who marches, dispatch them, and the field becomes their
            own. You can pause and offer counsel. You can call them home. And when the
            quest ends, in glory or in ruin, its scroll waits in the Hall of Returns.
          </p>
        </section>

        <section style={{ marginBottom: 14 }}>
          <h3 style={{ color: '#7a1818', marginBottom: 6 }}>Getting about</h3>
          <p style={{ marginTop: 4, lineHeight: 1.6 }}>
            Use the arrow keys to walk. Press Enter when you&apos;re near a sign or a
            door. Click on a hall in the row atop the screen and you&apos;ll arrive
            directly. Click anywhere on the field and the bards&apos; music will start
            to play — they&apos;re a touch shy until you give them a sign you&apos;re
            listening. Tab cycles between nearby interactives. Esc closes any open
            conversation.
          </p>
        </section>

        <section style={{ marginBottom: 14 }}>
          <h3 style={{ color: '#7a1818', marginBottom: 6 }}>Style your avatar</h3>
          <p style={{ marginTop: 4, lineHeight: 1.6, marginBottom: 10 }}>
            Pick a tunic and hair colour to mark yourself in the realm. Your
            choice is saved in this browser and applies the next time you
            change scenes.
          </p>
          <PlayerWardrobeSection />
        </section>

        <section style={{ marginBottom: 14 }}>
          <h3 style={{ color: '#7a1818', marginBottom: 6 }}>A word, before you go</h3>
          <p style={{ marginTop: 4, lineHeight: 1.6 }}>
            *lowers voice slightly.* A small truth, lest you wonder. The adventurers
            you meet at first are gentle spirits — they nod, they wander, they ask
            questions, but they don&apos;t truly work the field. If you wish to send a
            real one — one who will read your codebase and act upon it — wake the
            server with {C('CODE_QUESTS_USE_REAL_AGENT=1')} and keep the {C('claude')}{' '}
            binary upon your PATH. The Oracle&apos;s prophecies grow sharper, too, when
            you grant her an {C('ANTHROPIC_API_KEY')}. Without these, your adventurers
            walk in dream — useful enough for learning the realm, less so for fixing
            what&apos;s broken in it.
          </p>
        </section>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
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
