export interface ShowcaseStep {
  title: string;
  body: string;
  route: string;
  /** CSS selector for the element to highlight (optional) */
  anchorSelector?: string;
}

export const SHOWCASE_STEPS: ShowcaseStep[] = [
  {
    title: 'Step 1: Town Square — Your Guild HQ',
    body: 'Welcome! This is the Town Square — the entry point of Code Quests. Your adventurers assemble here. Every building serves a purpose: the War Room plans quests, the Armory equips them, and the Guild Hall shows your roster.',
    route: '/town/town-square',
    anchorSelector: '.town-square-panel, [aria-label="Town Square"]',
  },
  {
    title: 'Step 2: War Room — The Epic Board',
    body: "The War Room holds your epics — long-running initiatives made of multiple quests. Here we have 'Modernize the Auth System' with 3 quests: JWT migration, copy update, and a password strength meter.",
    route: '/town/war-room',
    anchorSelector: '[role="dialog"]',
  },
  {
    title: 'Step 3: Armory — Auto-Match & Equipment',
    body: "The Armory pairs each quest with the best adventurer. Watch as Brielle the Bold (claude-opus-4-7) is auto-matched to the JWT quest based on her type_safety specialization and 8 prior wins.",
    route: '/town/armory',
    anchorSelector: '[role="dialog"]',
  },
  {
    title: 'Step 4: Quests Dispatched — Party in Motion',
    body: 'All three quests are now active in parallel. Each adventurer is in their own scene: Brielle in the dungeon, Tess in the cave, Rook in the forest. The Town Square shows live status.',
    route: '/town/town-square',
    anchorSelector: '.active-quest-peek',
  },
  {
    title: 'Step 5: Tess vs Grognak — Known Monster',
    body: "Tess encounters Grognak the Lint Goblin — a known nemesis from the guild bestiary. Linter's Bane is equipped and the skill activates automatically. Grognak is defeated in one strike.",
    route: `/quest/quest-showcase-copy`,
    anchorSelector: '.quest-scene, .monster-card',
  },
  {
    title: 'Step 6: Rook vs the Imp — Fresh Encounter',
    body: "Rook meets a fresh Imp of Type Errors. The Wraith Banisher skill fires. The encounter is recorded in the project bestiary — next time this Imp appears, the guild is ready.",
    route: `/quest/quest-showcase-meter`,
    anchorSelector: '.quest-scene, .monster-card',
  },
  {
    title: 'Step 7: Brielle — Needs Your Help',
    body: "Brielle hits a fork: jose or jsonwebtoken? She can't proceed alone. The PAUSED_INPUT modal appears with a bell flash. This is your moment — type 'Use jose.' and press Send.",
    route: `/quest/quest-showcase-jwt`,
    anchorSelector: '.paused-input-modal, [role="dialog"]',
  },
  {
    title: 'Step 8: Hall of Returns — Quest Failed',
    body: 'Despite your guidance, three type errors escalated into a Lich of Repeated Failures. Brielle returns to town. The Hall of Returns shows the failure timeline, and the recommendation: repost with type_whisperer equipped.',
    route: '/town/hall-of-returns',
    anchorSelector: '[role="dialog"]',
  },
  {
    title: 'Step 9: Re-Post Panel — Learn & Retry',
    body: "The re-post panel lets you adjust equipment before trying again. Equip type_whisperer — the skill that counters TypeScript type errors. Brielle earns a scar from this attempt, but gains wisdom.",
    route: '/town/hall-of-returns',
    anchorSelector: '.repost-panel, [role="dialog"]',
  },
  {
    title: "Step 10: Brielle's Second Attempt — Victory",
    body: "With type_whisperer equipped, Brielle blitzes through the type errors. The victory fanfare plays. All three quests complete: Brielle's JWT migration, Tess's copy update, Rook's password meter.",
    route: `/quest/quest-showcase-jwt`,
    anchorSelector: '.victory-fanfare, .quest-complete-banner',
  },
  {
    title: 'Step 11: Library — AC Cartographer Candidate',
    body: 'The pattern-matching engine noticed a recurring AC mismatch across quests and proposed a new skill: AC Cartographer. Visit the Skills tab to confirm or dismiss it. Confirmed skills become part of your permanent arsenal.',
    route: '/town/library',
    anchorSelector: '[role="dialog"]',
  },
  {
    title: 'Step 12: Hall of Returns — The Full Arc',
    body: "All 3 quests are complete. Brielle shows both her scar from the JWT failure and her win. The epic 'Modernize the Auth System' is done. That's Code Quests: plan, dispatch, learn, grow.",
    route: '/town/hall-of-returns',
    anchorSelector: '[role="dialog"]',
  },
];
