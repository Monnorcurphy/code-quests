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
    greeting: '*glances up from the map.* "You\'ve got something to dispatch. Sit. Briefing\'s three minutes."',
    sections: [
      {
        title: 'What you\'re really doing here',
        body: (
          <>
            A quest is one ticket. One bit of broken thing. Not &ldquo;make auth
            better&rdquo; — that&apos;s a campaign, and I don&apos;t dispatch adventurers
            on campaigns. If your brief sprawls, split it. Two clean missions beat one
            tangled one, every time. I&apos;ll brief two adventurers before I send one
            confused.
          </>
        ),
      },
      {
        title: 'The brief I want to see',
        body: (
          <>
            <p style={{ marginTop: 0 }}>
              <strong>Title.</strong> Sharp. Seven words or fewer. Concrete nouns and
              verbs. {C('Reset password 404s')} — NOT {C('Auth issue')}. If you
              can&apos;t write a sharp title, you don&apos;t understand the work yet.
              Go figure it out, then come back.
            </p>
            <p>
              <strong>Mission.</strong> What problem are we solving? When the adventurer
              hits something the spec didn&apos;t cover, the mission tells them which
              way to lean. No mission, no judgment — they ship the letter and miss the
              spirit.
            </p>
            <p>
              <strong>Acceptance criteria.</strong> Facts the Oracle can verify. Hard
              yes-or-no. {C('Returns 200 on a valid email')} — I can prove that on
              the return. {C('Auth works well')} — what does that even mean, soldier?
              I can&apos;t prove it. I can&apos;t measure it. So it isn&apos;t a
              criterion. It&apos;s a wish.
            </p>
          </>
        ),
      },
      {
        title: 'What I see fail most',
        body: (
          <>
            Two quests crammed into one. Vague criteria. No mission, so the adventurer
            freelances and ships the wrong thing well. And the worst — dispatching with
            gear I haven&apos;t issued. Visit Smith Bran before you walk out that door,
            or your adventurer comes home in pieces.
          </>
        ),
      },
    ],
    primaryAction: { label: 'Approach the Planning Table', modal: 'draft' },
  },
  'seer-caelis': {
    name: 'Seer Caelis',
    role: 'Oracle Priestess',
    greeting: '"You enter to know the shape of victory. Sit. I find most do not have time for riddles — so I will speak plainly."',
    sections: [
      {
        title: 'What a criterion is',
        body: (
          <>
            A criterion is a covenant. Words your adventurer carries into the field.
            Words we read together when they return. If the words pass, the quest
            passed. If they fail, the quest failed. The Oracle does not weigh feelings.
            The Oracle confirms facts.
          </>
        ),
      },
      {
        title: 'Speak in things I can see',
        body: (
          <>
            Hear two covenants. &ldquo;Returns 200 for a valid email.&rdquo; I can read
            this. I will know whether it passed or failed. Now hear this: &ldquo;Auth
            works well.&rdquo; Whose &ldquo;well&rdquo;? Mine is not yours. Words like
            these are clouds — beautiful, perhaps, but I cannot touch them. Write what
            I can touch.
          </>
        ),
      },
      {
        title: 'Think long… then lock.',
        body: (
          <>
            Think long before you write a criterion. Sit with it. Test it against the
            edges. Once your adventurer departs, the covenant is sealed — and to change
            it mid-quest is to move the mark while the arrow is in flight. The arrow
            misses. The adventurer fails through no fault of their own. An arrow finds
            a still mark but misses a moving one.
          </>
        ),
      },
    ],
    primaryAction: { label: 'Consult the Crystal Ball', modal: 'oracle' },
  },
  'sage-mireldine': {
    name: 'Sage Mireldine',
    role: 'Librarian',
    greeting: '*peers over half-moon spectacles.* "Welcome to my stacks. Mind the dust. You\'ve come about context — or perhaps you\'ve heard the Bestiary muttering in your sleep. Either way. Pull up a chair. I have time."',
    sections: [
      {
        title: 'What context is',
        body: (
          <>
            Context is the lore your codebase keeps but never writes down.
            &ldquo;Imports are absolute, never relative past two levels.&rdquo;
            &ldquo;The legacy module is haunted — don&apos;t touch it.&rdquo;
            &ldquo;All errors flow through this handler.&rdquo; These are the rules the
            village knows in its bones. Without them, your adventurer reinvents the
            village every time they ride out. Costly. Slow. And they trample the herb
            garden.
          </>
        ),
      },
      {
        title: 'What goes in the satchel',
        body: (
          <>
            Pointers to the right tomes — file paths the adventurer should read first.
            Design documents. Conventions phrased plainly. And — this matters — what to
            leave alone. The generated code. The shared infrastructure. The places
            where dragons sleep. An adventurer who doesn&apos;t know what NOT to touch
            will touch everything.
          </>
        ),
      },
      {
        title: 'The Bestiary',
        body: (
          <>
            Every monster your adventurers have faced is recorded in these volumes.
            Lint goblins. Typecheck imps. Flaky-test wraiths. Each entry has its
            weakness logged — what tool struck the killing blow, what skill held it at
            bay. When new adventurers ride out, they read first what their forebears
            wrote. The realm grows wiser, monster by monster.
          </>
        ),
      },
    ],
    primaryAction: { label: 'Consult the Ancient Tome', modal: 'library' },
  },
  'innkeep-rorek': {
    name: 'Innkeep Rorek',
    role: 'Tavernkeeper',
    greeting: '*wipes a mug with a rag.* "Pull up a stool, friend. Every adventurer who\'s come through that door has a tale, and most of \'em start with \'I didn\'t expect that.\' Edge cases, that\'s what we call \'em. Let me pour you a story."',
    sections: [
      {
        title: 'What an edge case is',
        body: (
          <>
            It&apos;s the weird turn in the road. The path that&apos;s not on any map.
            Empty arrays where a list was promised. A user with no email — and trust me,
            there&apos;s always a user with no email. A token that&apos;s expired but
            says it isn&apos;t. The happy path&apos;s what&apos;s in your spec; the
            edge case is what&apos;s in the field. Both are real. Only one&apos;s in the
            brief.
          </>
        ),
      },
      {
        title: 'Why give them a heads-up',
        body: (
          <>
            Without one, the adventurer takes the easy road. Ships the brittle fix.
            Sleeps eight hours. Wakes at 2am because the migration ran twice.{' '}
            <em>*chuckles*</em> — I&apos;ve heard that one more times than I can count.
            Costs you a sentence to pre-warn. Saves you the hot fix. Saves them their
            honor.
          </>
        ),
      },
      {
        title: 'Tales worth telling',
        body: (
          <>
            &ldquo;The migration breaks if you run it twice — make it idempotent,
            lad.&rdquo; &ldquo;The legacy API returns 200 with errors in the body —
            check the body, not the status.&rdquo; &ldquo;Users without an email
            exist — handle the null kindly.&rdquo; Tales like these. Pour them
            generously.
          </>
        ),
      },
    ],
    primaryAction: { label: 'Tap the Ale Barrel', modal: 'tavern' },
  },
  'smith-bran': {
    name: 'Smith Bran',
    role: 'Blacksmith',
    greeting: '*hammer ringing.* "Hold a moment." *sets it down.* "Right, you\'re new. Equipment — what to give your adventurer before they march. Smart of you to ask. I\'ve buried too many for skipping this conversation."',
    sections: [
      {
        title: 'What I forge here',
        body: (
          <>
            <p style={{ marginTop: 0 }}>
              Three kinds of gear. <strong>Skills</strong> — what they know how to do.
              Linting. Migrations. Performance work. Skills get forged here from
              monsters defeated three times the same way. Hard-won, slow to make, worth
              their weight in silver.
            </p>
            <p>
              <strong>Tools</strong> — what they wield. Code editor. Test runner. Build
              system. Deploy scripts. Without tools they&apos;re swinging fists at
              typecheck imps. They lose every time.
            </p>
            <p>
              And <strong>MCP servers</strong> — what they can summon. Knowledge bases.
              Cloud consoles. Remote APIs. Powers they call on from afar. Each one a
              relationship with another realm.
            </p>
          </>
        ),
      },
      {
        title: 'Match the loadout to the work',
        body: (
          <>
            A typescript-bug quest with no typecheck tool? You&apos;re sending them into
            the dragon&apos;s den unarmed. A migration quest with no migration tool?
            Burying them yourself. Pick the gear for the road they&apos;re walking.{' '}
            <em>*picks the hammer back up*</em> Now go choose.
          </>
        ),
      },
    ],
    primaryAction: { label: 'Stand at the Loadout Workbench', modal: 'armory-loadout' },
  },
  'master-eldra': {
    name: 'Master Eldra',
    role: 'Guild Master',
    greeting: '"Come in. Close the door." *gestures to a chair.* "You want to understand the guild. Many treat their roster like a tool drawer — pick one, swap one out. They learn the hard way that&apos;s wrong. Sit. Let me tell you what an adventurer truly is."',
    sections: [
      {
        title: 'What they are',
        body: (
          <>
            Each adventurer in your roster is a persistent soul. They carry every quest
            they&apos;ve ever taken. The skills they&apos;ve forged. The monsters
            they&apos;ve slain. The scars they earned the first time they failed. Two
            adventurers I trained the same way will, after a year, be different people.
            So choose them with the care you&apos;d choose a friend.
          </>
        ),
      },
      {
        title: 'When to recruit anew',
        body: (
          <>
            When you need a kind of work no one in the guild knows yet — that is
            reason. When you must run two quests in the same hour, and have no one
            free — that is reason. When an adventurer carries scars from one kind of
            monster so deep they flinch at the sight of it — that is reason. Otherwise,
            dispatch the ones you have. Familiarity is its own kind of equipment.
          </>
        ),
      },
      {
        title: 'Reading the roster',
        body: (
          <>
            Each name in the book has a history. Quests won. Monsters slain. Failures,
            and what was learned from them. Read before you dispatch. A dragon-slayer
            for dragon work. A goblin-puncher for lint work. Match the soul to the
            road.
          </>
        ),
      },
    ],
    primaryAction: { label: 'Open the Guild Roster', modal: 'guild-hall' },
  },
  'keeper-vorn': {
    name: 'Keeper Vorn',
    role: 'Hall of Returns Undertaker',
    greeting: '*looks up slowly. Lowers his voice.* "Quietly, please. The scrolls rest here." *gestures to the shelves* "Every quest, ended in glory or in ruin, returns to me. I lay them in their place. You wish to read? Read."',
    sections: [
      {
        title: 'Why the scrolls matter',
        body: (
          <>
            They are the only honest record of the realm. The brief was a hope. The
            quest was the work. The scroll is what happened. Read the scrolls and the
            next quest goes wiser. Ignore them, and you will commission the same brief
            in three months, with the same wording — and the same scroll will land on
            my counter.
          </>
        ),
      },
      {
        title: 'What to look for',
        body: (
          <>
            The failure summaries first. What monster ended the quest? Could a tool, or
            a forewarning, have spared the adventurer? Then the victories — the same
            defeat three times is no longer luck. It is a skill, waiting to be forged
            at Sage Mireldine&apos;s tables. And the scars. Mark a scroll with a scar,
            so the adventurers who follow will remember.
          </>
        ),
      },
      {
        title: 'Closing the circle',
        body: (
          <>
            Read. Identify. Forge a skill. Equip a tool. Send a forewarning to Rorek.
            The next quest is better. <em>*folds hands*</em> That is how this realm
            grows wiser. Slowly. With humility. Scroll by scroll.
          </>
        ),
      },
    ],
    primaryAction: { label: 'Walk among the Returned Scrolls', modal: 'hall-of-returns' },
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
