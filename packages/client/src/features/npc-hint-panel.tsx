import { useRef, useEffect, type ReactNode } from 'react';
import { useFocusTrap } from '../lib/use-focus-trap';
import { useTownStore, type NpcKey } from '../stores/town-store';

// Each NPC teaches the user what their building is for — not just another
// button. Click a tome / table / barrel to ACT; click the NPC to LEARN.

interface NpcContent {
  name: string;
  role: string;
  greeting: string;
  sections: { title: string; body: ReactNode }[];
  // Action prompt at the bottom — opens the building's main modal so the
  // user can go straight from learning to doing.
  primaryAction: { label: string; modal: 'recruit' | 'draft' | 'oracle' | 'library' | 'tavern' | 'armory-loadout' | 'guild-hall' | 'hall-of-returns' | 'quest-board' };
}

const C = (s: string) => (
  <code style={{ background: '#f5ecd6', padding: '1px 4px', borderRadius: 3, fontSize: '0.85em' }}>
    {s}
  </code>
);

const NPC_CONTENT: Record<NpcKey, NpcContent> = {
  'commander-tyra': {
    name: 'Commander Tyra',
    role: 'War Room Officer',
    greeting: '"You came to draft a quest. Good. Let me tell you what makes one worth dispatching."',
    sections: [
      {
        title: 'What is a quest?',
        body: (
          <>
            A quest is a <strong>ticket</strong> — one well-scoped piece of work you want an
            adventurer to complete. It is not a story, not a wishlist. Think:
            &ldquo;Fix the login redirect loop,&rdquo; not &ldquo;Make auth better.&rdquo;
          </>
        ),
      },
      {
        title: 'A successful quest has three pillars',
        body: (
          <ol style={{ paddingLeft: 20, lineHeight: 1.7 }}>
            <li>
              <strong>A specific title.</strong> The adventurer reads this first. Concrete
              nouns and verbs win. {C('"Reset password 404s"')} beats {C('"Auth issue"')}.
            </li>
            <li>
              <strong>A mission (description) that names the why.</strong> What hurts today?
              What changes when this ships? The mission lets the adventurer make judgment
              calls when the spec is ambiguous.
            </li>
            <li>
              <strong>Acceptance criteria the Oracle can verify.</strong> Measurable. Binary.
              Each one is a checkbox: pass or fail, no opinion. {C('"Returns 200 on valid email"')}
              not {C('"Auth works well"')}.
            </li>
          </ol>
        ),
      },
      {
        title: 'Common mistakes to avoid',
        body: (
          <ul style={{ paddingLeft: 20, lineHeight: 1.7 }}>
            <li>Two quests in one. Split them.</li>
            <li>Vague ACs (&ldquo;is fast,&rdquo; &ldquo;feels right&rdquo;) — the adventurer can&apos;t prove they passed.</li>
            <li>No mission. Adventurer ships the letter, misses the spirit.</li>
            <li>Quest depends on something not in equipment. Visit the Armory first.</li>
          </ul>
        ),
      },
    ],
    primaryAction: { label: 'Open the Planning Table', modal: 'draft' },
  },
  'seer-caelis': {
    name: 'Seer Caelis',
    role: 'Oracle Priestess',
    greeting: '"You wish to know the shape of success. Wise. Acceptance criteria are the prophecy your quest must fulfill."',
    sections: [
      {
        title: 'What are acceptance criteria?',
        body: (
          <>
            ACs are the contract between you and the adventurer. Each one is a
            <strong> testable statement</strong> about the finished work. If the AC passes,
            success. If it fails, the work isn&apos;t done. No interpretation.
          </>
        ),
      },
      {
        title: 'Good ACs vs. bad ACs',
        body: (
          <div style={{ lineHeight: 1.6 }}>
            <p style={{ margin: '4px 0' }}>
              <strong>Bad:</strong> {C('"Code is clean"')} — Whose definition?
            </p>
            <p style={{ margin: '4px 0' }}>
              <strong>Good:</strong> {C('"Lint passes with zero warnings"')} — Verifiable.
            </p>
            <p style={{ margin: '4px 0' }}>
              <strong>Bad:</strong> {C('"Tests are good"')} — Vague.
            </p>
            <p style={{ margin: '4px 0' }}>
              <strong>Good:</strong> {C('"Adds a test that fails before the fix and passes after"')} — Binary.
            </p>
          </div>
        ),
      },
      {
        title: 'Lock them before dispatch',
        body: (
          <>
            Once dispatched, ACs are immutable. Changing them mid-quest is moving the
            target — the adventurer can&apos;t hit a moving target reliably. Lock now,
            iterate next quest.
          </>
        ),
      },
    ],
    primaryAction: { label: 'Open the Crystal Ball', modal: 'oracle' },
  },
  'sage-mireldine': {
    name: 'Sage Mireldine',
    role: 'Librarian',
    greeting: '"Welcome to the stacks. The Library is where your adventurer learns the local rules — and remembers every monster they\'ve faced."',
    sections: [
      {
        title: 'What is context?',
        body: (
          <>
            Context is the <strong>lore</strong> of your codebase: which files to read first,
            naming conventions, deprecated APIs, the &ldquo;we don&apos;t do that here&rdquo; rules.
            Without it, an adventurer reinvents the wheel.
          </>
        ),
      },
      {
        title: 'What goes in context?',
        body: (
          <ul style={{ paddingLeft: 20, lineHeight: 1.7 }}>
            <li>Paths to the relevant files (so the adventurer doesn&apos;t have to grep)</li>
            <li>Pointers to design docs or ADRs</li>
            <li>Conventions: &ldquo;all imports use absolute paths&rdquo;</li>
            <li>What NOT to touch: shared infra, generated code</li>
          </ul>
        ),
      },
      {
        title: 'The Bestiary',
        body: (
          <>
            Every monster (failure type) your adventurers have faced is logged here:
            lint goblins, typecheck imps, flaky-test wraiths. Each entry shows how it
            was defeated. Future quests get easier as the bestiary grows — the more
            you&apos;ve fought, the less the new monsters surprise you.
          </>
        ),
      },
    ],
    primaryAction: { label: 'Open the Ancient Tome', modal: 'library' },
  },
  'innkeep-rorek': {
    name: 'Innkeep Rorek',
    role: 'Tavernkeeper',
    greeting: '"Every adventurer who comes through here has a story about a quest gone sideways. Edge cases. Let me tell you what they are."',
    sections: [
      {
        title: 'What are edge cases?',
        body: (
          <>
            Edge cases are the <strong>weird paths</strong> your adventurer might walk.
            They&apos;re what the happy-path spec doesn&apos;t cover but the real world hits
            constantly: stale tokens, empty arrays, network timeouts, race conditions.
          </>
        ),
      },
      {
        title: 'Why pre-warn the adventurer?',
        body: (
          <>
            Without warning, the adventurer assumes the happy path and ships brittle
            code. With warning, they handle it deliberately. Cost: a sentence. Payoff:
            no 2am hot-fix.
          </>
        ),
      },
      {
        title: 'Examples worth pre-warning',
        body: (
          <ul style={{ paddingLeft: 20, lineHeight: 1.7 }}>
            <li>&ldquo;This migration breaks if you run it twice — make it idempotent.&rdquo;</li>
            <li>&ldquo;The legacy API returns 200 with an error body — check {C('body.success')}.&rdquo;</li>
            <li>&ldquo;Users without an email exist — handle null gracefully.&rdquo;</li>
            <li>&ldquo;On Safari, the date input only accepts {C('YYYY-MM-DD')}.&rdquo;</li>
          </ul>
        ),
      },
    ],
    primaryAction: { label: 'Open the Ale Barrel', modal: 'tavern' },
  },
  'smith-bran': {
    name: 'Smith Bran',
    role: 'Blacksmith',
    greeting: '"Every adventurer needs the right tools for the job. Let me show you what equipment is and how to pick well."',
    sections: [
      {
        title: 'What is equipment?',
        body: (
          <>
            Equipment is the <strong>capability bundle</strong> your adventurer carries:
          </>
        ),
      },
      {
        title: 'Three slots',
        body: (
          <ul style={{ paddingLeft: 20, lineHeight: 1.7 }}>
            <li>
              <strong>Skills</strong> — what they know how to do. Linting. Migration writing.
              Performance profiling. Skills are forged at the Library when monsters are
              repeatedly defeated the same way.
            </li>
            <li>
              <strong>Tools</strong> — what they can wield. Code editor, test runner, build
              system, deploy scripts.
            </li>
            <li>
              <strong>MCP servers</strong> — what they can summon. Knowledge bases, APIs,
              cloud consoles. Each MCP server is a power they can call on remotely.
            </li>
          </ul>
        ),
      },
      {
        title: 'Why does it matter?',
        body: (
          <>
            A typescript-error quest with no typecheck tool is doomed. A migration quest
            with no migration tool is doomed. Quests <strong>cannot</strong> succeed without
            the equipment to do the work. Load up before dispatch — not mid-fight.
          </>
        ),
      },
    ],
    primaryAction: { label: 'Open the Loadout Workbench', modal: 'armory-loadout' },
  },
  'master-eldra': {
    name: 'Master Eldra',
    role: 'Guild Master',
    greeting: '"Each adventurer in your roster is a Claude Code agent — but each one carries different scars, different victories, different specialties."',
    sections: [
      {
        title: 'What is an adventurer?',
        body: (
          <>
            An adventurer is a <strong>persistent agent identity</strong> across quests.
            They accumulate experience: skills they&apos;ve forged, monsters they&apos;ve
            slain, scars from failed quests. The roster is yours forever — recruit
            once, dispatch many times.
          </>
        ),
      },
      {
        title: 'When to recruit a new one',
        body: (
          <ul style={{ paddingLeft: 20, lineHeight: 1.7 }}>
            <li>Specialty doesn&apos;t exist yet (frontend vs. backend vs. infra)</li>
            <li>Existing adventurer is mid-quest and you need a parallel run</li>
            <li>An adventurer has too many scars from one type of monster — fresh eyes</li>
          </ul>
        ),
      },
      {
        title: 'Picking who to dispatch',
        body: (
          <>
            Read their record. The roster shows quests-won, monsters-slain per type, and
            recent failure patterns. Match adventurer to quest. A dragon-slayer for a
            dragon quest. A goblin-puncher for a lint quest.
          </>
        ),
      },
    ],
    primaryAction: { label: 'Open the Guild Roster', modal: 'guild-hall' },
  },
  'keeper-vorn': {
    name: 'Keeper Vorn',
    role: 'Hall of Returns',
    greeting: '"Every quest, win or lose, returns here. Read these scrolls and your next quest will be wiser."',
    sections: [
      {
        title: 'Why review returned quests?',
        body: (
          <>
            Returned quests are the <strong>most valuable scrolls in the realm</strong>.
            They tell you what worked, what didn&apos;t, and why. The same mistake made
            three times is a process bug. The same victory three times is a skill
            candidate waiting to be forged.
          </>
        ),
      },
      {
        title: 'What to look for',
        body: (
          <ul style={{ paddingLeft: 20, lineHeight: 1.7 }}>
            <li>
              <strong>Failure summaries</strong> — what monster killed the run? Could a
              tool, skill, or pre-warned edge case have prevented it?
            </li>
            <li>
              <strong>Repeated victories</strong> — the same defeat-style across multiple
              quests? Forge a skill in the Library.
            </li>
            <li>
              <strong>Scars</strong> — mark a returned quest with a scar to remember.
              Adventurers carry their scars; future quests benefit.
            </li>
          </ul>
        ),
      },
      {
        title: 'Closing the loop',
        body: (
          <>
            Read a scroll → identify a pattern → either forge a skill, equip a tool, or
            pre-warn an edge case → next quest goes better. This is how the realm
            improves.
          </>
        ),
      },
    ],
    primaryAction: { label: 'Open the Returned Scrolls', modal: 'hall-of-returns' },
  },
};

interface NpcHintPanelProps {
  npcKey: NpcKey;
  onClose: () => void;
  onPrimary: (modal: NpcContent['primaryAction']['modal']) => void;
}

export default function NpcHintPanel({ npcKey, onClose, onPrimary }: NpcHintPanelProps) {
  const content = NPC_CONTENT[npcKey];
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
      aria-labelledby="npc-hint-title"
    >
      <div ref={panelRef} className="modal-panel" style={{ maxWidth: 680 }}>
        <h2 id="npc-hint-title" className="modal-title">
          {content.name}
        </h2>
        <p style={{ margin: '2px 0 16px', color: '#7a4a18', fontWeight: 600 }}>
          {content.role}
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
          {content.greeting}
        </p>

        {content.sections.map((s) => (
          <section key={s.title} style={{ marginBottom: 14 }}>
            <h3 style={{ color: '#7a1818', marginBottom: 6 }}>{s.title}</h3>
            <div style={{ marginTop: 4, lineHeight: 1.6 }}>{s.body}</div>
          </section>
        ))}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button
            ref={closeRef}
            type="button"
            className="btn-secondary"
            onClick={onClose}
          >
            I&apos;ll think on it
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onPrimary(content.primaryAction.modal)}
          >
            {content.primaryAction.label}
          </button>
        </div>
      </div>
    </div>
  );
}

export function NpcHintPanelContainer() {
  const activeNpc = useTownStore((s) => s.activeNpc);
  const setActiveModal = useTownStore((s) => s.setActiveModal);
  if (!activeNpc) return null;
  return (
    <NpcHintPanel
      npcKey={activeNpc}
      onClose={() => setActiveModal(null)}
      onPrimary={(modal) => setActiveModal(modal)}
    />
  );
}
