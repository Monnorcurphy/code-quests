import path from 'path';
import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Phase 11 Showcase Walkthrough — screenshot capture
//
// Produces 12 PNGs in deterministic order under assets/screenshots/phase-11/.
// Run with: pnpm test:e2e --grep "Showcase walkthrough"
//
// This spec mocks all API calls so it works headlessly without seeded DB data.
// ---------------------------------------------------------------------------

const SCREENSHOTS_DIR = path.resolve(__dirname, '../../../../assets/screenshots/phase-11');

const QUEST_JWT = 'quest-showcase-jwt';
const QUEST_COPY = 'quest-showcase-copy';
const QUEST_METER = 'quest-showcase-meter';
const QUEST_JWT_REPOST = 'quest-showcase-jwt-v2';
const ADV_BRIELLE = 'adv-showcase-brielle';
const ADV_TESS = 'adv-showcase-tess';
const ADV_ROOK = 'adv-showcase-rook';

const MOCK_ADVENTURERS = [
  {
    id: ADV_BRIELLE,
    name: 'Brielle the Bold',
    class: 'champion',
    modelId: 'claude-opus-4-7',
    createdAt: '2026-05-01T00:00:00.000Z',
    stats: { questsWon: 8, monstersSlain: { goblin_linter: 8, imp_typecheck: 4 } },
    specializations: ['type_safety', 'refactoring'],
    scars: [],
  },
  {
    id: ADV_TESS,
    name: 'Tess the Tenacious',
    class: 'scout',
    modelId: 'claude-haiku-4-5-20251001',
    createdAt: '2026-05-01T00:00:00.000Z',
    stats: { questsWon: 2, monstersSlain: { goblin_linter: 2 } },
    specializations: ['frontend', 'copy_editing'],
    scars: [
      {
        questId: 'quest-demo-pre-scar',
        failureSummary: 'AC mismatch caused failure on a prior auth task',
        monsterIdAtFatal: 'the-jwt-hydra',
        occurredAt: '2026-04-24T10:30:00.000Z',
      },
    ],
  },
  {
    id: ADV_ROOK,
    name: 'Rook the Relentless',
    class: 'ranger',
    modelId: 'claude-sonnet-4-6',
    createdAt: '2026-05-01T00:00:00.000Z',
    stats: { questsWon: 5, monstersSlain: { wraith_flaky_test: 3 } },
    specializations: ['testing', 'debugging'],
    scars: [],
  },
];

const MOCK_SHOWCASE_QUESTS = [
  {
    id: QUEST_JWT,
    epicId: 'epic-showcase-auth',
    title: 'Migrate to JWT',
    description: 'Replace session-cookie auth with JWT tokens.',
    acceptanceCriteria: [
      'All API endpoints accept and validate JWT Bearer tokens',
      'Existing sessions are invalidated on migration cutover',
      'JWT expiry is enforced server-side with a 15-minute TTL',
      'Refresh token rotation flow is implemented and covered by integration tests',
    ],
    edgeCases: ['Users with in-flight requests lose their session'],
    context: 'See ADR-12 for the JWT library decision.',
    status: 'idle',
    adventurerId: null,
    agentId: null,
    currentScene: 'quest-forest',
    specAudit: { runAt: '2026-05-28T10:00:00.000Z', gaps: [], bypassed: false },
    equipment: { skillIds: ['type_whisperer', 'linters_bane'], toolIds: [], mcpServerIds: [] },
    failureSummary: null,
    createdAt: '2026-05-28T10:00:00.000Z',
    updatedAt: '2026-05-28T10:00:00.000Z',
  },
  {
    id: QUEST_COPY,
    epicId: 'epic-showcase-auth',
    title: 'Update login form copy',
    description: 'Update user-facing copy to match new brand voice guidelines.',
    acceptanceCriteria: [
      'All button labels use sentence case per the brand guide',
      'Error messages match the approved copy list',
    ],
    edgeCases: ['Screen-reader users relying on existing aria-labels must not regress'],
    context: 'Brand voice guidelines are in Notion.',
    status: 'idle',
    adventurerId: null,
    agentId: null,
    currentScene: 'quest-forest',
    specAudit: { runAt: '2026-05-28T10:00:00.000Z', gaps: [], bypassed: false },
    equipment: { skillIds: ['linters_bane'], toolIds: [], mcpServerIds: [] },
    failureSummary: null,
    createdAt: '2026-05-28T10:00:00.000Z',
    updatedAt: '2026-05-28T10:00:00.000Z',
  },
  {
    id: QUEST_METER,
    epicId: 'epic-showcase-auth',
    title: 'Add password strength meter',
    description: 'Add a visual password strength indicator to the registration form.',
    acceptanceCriteria: [
      'Strength meter renders with four levels: weak, fair, strong, very strong',
      'Meter updates on every keystroke',
      'Color is not the only indicator',
    ],
    edgeCases: ['Mobile keyboards that hide the password while typing'],
    context: 'Use zxcvbn for strength scoring.',
    status: 'idle',
    adventurerId: null,
    agentId: null,
    currentScene: 'quest-forest',
    specAudit: { runAt: '2026-05-28T10:00:00.000Z', gaps: [], bypassed: false },
    equipment: { skillIds: ['wraith_banisher'], toolIds: [], mcpServerIds: [] },
    failureSummary: null,
    createdAt: '2026-05-28T10:00:00.000Z',
    updatedAt: '2026-05-28T10:00:00.000Z',
  },
];

const MOCK_QUESTS_ACTIVE = [
  { ...MOCK_SHOWCASE_QUESTS[0], status: 'active', adventurerId: ADV_BRIELLE, agentId: 'agent-brielle', currentScene: 'quest-dungeon' },
  { ...MOCK_SHOWCASE_QUESTS[1], status: 'active', adventurerId: ADV_TESS, agentId: 'agent-tess', currentScene: 'quest-cave' },
  { ...MOCK_SHOWCASE_QUESTS[2], status: 'active', adventurerId: ADV_ROOK, agentId: 'agent-rook', currentScene: 'quest-forest' },
];

const MOCK_SKILLS = [
  { id: 'linters_bane', name: "Linter's Bane", description: 'Slays lint errors on sight', status: 'active', hitCount: 11, monsterTypeIds: ['goblin_linter', 'imp_typecheck'], createdAt: '2026-05-01T00:00:00.000Z' },
  { id: 'type_whisperer', name: 'Type Whisperer', description: 'Resolves TypeScript type errors', status: 'active', hitCount: 7, monsterTypeIds: ['imp_typecheck'], createdAt: '2026-05-01T00:00:00.000Z' },
  { id: 'wraith_banisher', name: 'Wraith Banisher', description: 'Banishes flaky tests', status: 'active', hitCount: 3, monsterTypeIds: ['wraith_flaky_test'], createdAt: '2026-05-01T00:00:00.000Z' },
  { id: 'ac_cartographer', name: 'AC Cartographer', description: 'Maps acceptance criteria mismatches', status: 'candidate', hitCount: 2, monsterTypeIds: ['hydra_ac_mismatch'], createdAt: '2026-05-01T00:00:00.000Z' },
];

const MOCK_EPIC = {
  id: 'epic-showcase-auth',
  title: 'Modernize the Auth System',
  goal: 'Migrate authentication infrastructure to modern JWT-based approach',
  createdAt: '2026-05-28T10:00:00.000Z',
};

const MOCK_AUTO_MATCH_JWT = {
  adventurerId: ADV_BRIELLE,
  adventurerName: 'Brielle the Bold',
  score: 92,
  reason: 'type_safety specialization + 8 prior wins (4 vs imp_typecheck)',
};

const MOCK_AUTO_MATCH_COPY = {
  adventurerId: ADV_TESS,
  adventurerName: 'Tess the Tenacious',
  score: 78,
  reason: 'copy_editing specialization + linters_bane skill equipped',
};

const MOCK_AUTO_MATCH_METER = {
  adventurerId: ADV_ROOK,
  adventurerName: 'Rook the Relentless',
  score: 74,
  reason: 'wraith_banisher skill aligns with flaky-test risk in strength-meter logic',
};

const MOCK_JWT_FAILED = {
  ...MOCK_SHOWCASE_QUESTS[0],
  status: 'returned_to_town',
  adventurerId: ADV_BRIELLE,
  agentId: 'agent-brielle',
  failureSummary: {
    fatalEncounterId: 'enc-lich-brielle',
    retries: 2,
    recommendation: 'repost_with_clarification',
    notes: 'Repeated TypeScript type errors escalated to a Lich. Equip type_whisperer on the next attempt.',
  },
};

const MOCK_POST_MORTEM_JWT = {
  quest: MOCK_JWT_FAILED,
  attempts: [
    {
      id: 'agent-brielle',
      startedAt: '2026-05-28T10:05:00.000Z',
      endedAt: '2026-05-28T10:35:00.000Z',
      events: [
        { type: 'progress', timestamp: '2026-05-28T10:05:00.000Z', message: 'Reading ADR-12 for JWT library guidance…' },
        { type: 'paused_input', timestamp: '2026-05-28T10:12:00.000Z', message: 'Which JWT library should I use — jose or jsonwebtoken?' },
        { type: 'progress', timestamp: '2026-05-28T10:15:00.000Z', message: 'Proceeding with jose as instructed…' },
        { type: 'combat', timestamp: '2026-05-28T10:20:00.000Z', message: 'Type error: Property \'payload\' does not exist on type \'string | JWTPayload\'' },
        { type: 'combat', timestamp: '2026-05-28T10:25:00.000Z', message: 'Type error: Argument of type \'string\' is not assignable to parameter of type \'KeyLike\'' },
        { type: 'combat', timestamp: '2026-05-28T10:30:00.000Z', message: 'Type error: Object is possibly \'undefined\' (refresh token handler)' },
        { type: 'failed', timestamp: '2026-05-28T10:35:00.000Z', reason: 'Lich of Repeated Failures rose after 3 type errors. Quest abandoned.' },
      ],
    },
  ],
  encounters: [
    {
      id: 'enc-imp-1', monsterId: 'imp-typecheck-brielle', questId: QUEST_JWT,
      appearedAt: '2026-05-28T10:20:00.000Z', resolvedAt: '2026-05-28T10:22:00.000Z',
      combatLog: ["Property 'payload' does not exist on type 'string | JWTPayload'"],
      outcome: 'escape', loot: [], monsterName: 'Imp of Type Error', spritePath: '/sprites/monsters/imp.png', difficulty: 2,
    },
    {
      id: 'enc-imp-2', monsterId: 'imp-typecheck-brielle', questId: QUEST_JWT,
      appearedAt: '2026-05-28T10:25:00.000Z', resolvedAt: '2026-05-28T10:27:00.000Z',
      combatLog: ["Argument of type 'string' is not assignable to parameter of type 'KeyLike'"],
      outcome: 'escape', loot: [], monsterName: 'Imp of Type Error', spritePath: '/sprites/monsters/imp.png', difficulty: 2,
    },
    {
      id: 'enc-lich-brielle', monsterId: 'lich-showcase', questId: QUEST_JWT,
      appearedAt: '2026-05-28T10:30:00.000Z', resolvedAt: '2026-05-28T10:35:00.000Z',
      combatLog: ['Lich of Repeated Failures rose after 3 type errors.', 'Quest abandoned.'],
      outcome: 'defeat', loot: [], monsterName: 'Lich of Repeated Failures', spritePath: '/sprites/monsters/lich.png', difficulty: 5,
    },
  ],
  failureSummary: MOCK_JWT_FAILED.failureSummary,
  adventurer: MOCK_ADVENTURERS[0],
};

const MOCK_JWT_REPOST = {
  ...MOCK_SHOWCASE_QUESTS[0],
  id: QUEST_JWT_REPOST,
  title: 'Migrate to JWT (v2)',
  status: 'complete',
  adventurerId: ADV_BRIELLE,
  agentId: 'agent-brielle-v2',
  equipment: { skillIds: ['type_whisperer', 'linters_bane'], toolIds: [], mcpServerIds: [] },
};

const MOCK_FINAL_COMPLETED = [
  { ...MOCK_SHOWCASE_QUESTS[1], status: 'complete', adventurerId: ADV_TESS },
  { ...MOCK_SHOWCASE_QUESTS[2], status: 'complete', adventurerId: ADV_ROOK },
  MOCK_JWT_REPOST,
];

// ---------------------------------------------------------------------------
// Route setup helper
// ---------------------------------------------------------------------------

async function setupBaseMocks(page: Parameters<typeof test.fn>[0]['page']) {
  await page.route('**/adventurers', (route) => {
    if (route.request().method() === 'GET' && !route.request().url().includes('/adventurers/')) {
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_ADVENTURERS) });
    } else {
      route.continue();
    }
  });

  await page.route(`**/adventurers/${ADV_BRIELLE}`, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_ADVENTURERS[0]) }),
  );
  await page.route(`**/adventurers/${ADV_TESS}`, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_ADVENTURERS[1]) }),
  );
  await page.route(`**/adventurers/${ADV_ROOK}`, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_ADVENTURERS[2]) }),
  );

  await page.route('**/epics', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify([MOCK_EPIC]) }),
  );

  await page.route('**/skills?**', (route) => {
    const url = route.request().url();
    if (url.includes('status=candidate')) {
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_SKILLS.filter((s) => s.status === 'candidate')) });
    } else if (url.includes('status=active')) {
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_SKILLS.filter((s) => s.status === 'active')) });
    } else {
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_SKILLS) });
    }
  });

  await page.route('**/monsters?**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) }),
  );
}

// ---------------------------------------------------------------------------
// The capture test — 12 sequential screenshots
// ---------------------------------------------------------------------------

test('Showcase walkthrough — capture 12 screenshots', async ({ page }) => {
  await setupBaseMocks(page);

  // ------------------------------------------------------------------
  // STEP 1: Town Square (idle state — quests not yet dispatched)
  // ------------------------------------------------------------------
  await page.route('**/quests/active', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) }),
  );
  await page.route('**/quests', (route) => {
    if (route.request().method() === 'GET' && !route.request().url().includes('/quests/')) {
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_SHOWCASE_QUESTS) });
    } else {
      route.continue();
    }
  });
  await page.route('**/hall-of-returns/quests?**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [], nextCursor: null }) }),
  );

  await page.goto('/town/town-square');
  await page.waitForSelector('.phaser-scene-canvas, canvas', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await expect(page).toHaveURL(/\/town\/town-square/);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step-01-town-square.png'), fullPage: false });

  // ------------------------------------------------------------------
  // STEP 2: War Room — epic "Modernize the Auth System" with 3 quests
  // ------------------------------------------------------------------
  await page.goto('/town/war-room');
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);
  await expect(page.getByText(/Modernize the Auth System/i)).toBeVisible();
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step-02-war-room-epic.png'), fullPage: false });

  // ------------------------------------------------------------------
  // STEP 3: Armory — auto-match preview for JWT quest
  // ------------------------------------------------------------------
  await page.route(`**/quests/${QUEST_JWT}`, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_SHOWCASE_QUESTS[0]) }),
  );
  await page.route(`**/quests/${QUEST_JWT}/auto-match`, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_AUTO_MATCH_JWT) }),
  );
  await page.route(`**/quests/${QUEST_COPY}/auto-match`, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_AUTO_MATCH_COPY) }),
  );
  await page.route(`**/quests/${QUEST_METER}/auto-match`, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_AUTO_MATCH_METER) }),
  );

  await page.goto('/town/armory');
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
  await expect(page.getByText(/Brielle the Bold/i)).toBeVisible();
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step-03-armory-auto-match.png'), fullPage: false });

  // ------------------------------------------------------------------
  // STEP 4: Party Map — all 3 quests active in parallel
  // ------------------------------------------------------------------
  await page.route('**/quests/active', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_QUESTS_ACTIVE) }),
  );
  await page.route(`**/quests/${QUEST_JWT}`, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_QUESTS_ACTIVE[0]) }),
  );
  await page.route(`**/quests/${QUEST_COPY}`, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_QUESTS_ACTIVE[1]) }),
  );
  await page.route(`**/quests/${QUEST_METER}`, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_QUESTS_ACTIVE[2]) }),
  );

  await page.goto('/town/town-square');
  await page.waitForTimeout(1200);
  await expect(page).toHaveURL(/\/town\/town-square/);
  // Open Party Map overlay
  const partyMapToggle = page.getByRole('button', { name: /party map/i });
  const hasPartyMap = await partyMapToggle.isVisible().catch(() => false);
  if (hasPartyMap) {
    await partyMapToggle.click();
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step-04-party-map-parallel.png'), fullPage: false });

  // ------------------------------------------------------------------
  // STEP 5: Tess quest — Grognak the Lint Goblin (known monster, defeated)
  // ------------------------------------------------------------------
  const tessCopyActive = { ...MOCK_QUESTS_ACTIVE[1], currentScene: 'quest-cave' };
  await page.route(`**/quests/${QUEST_COPY}`, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(tessCopyActive) }),
  );

  await page.goto(`/quest/${QUEST_COPY}`);
  await page.waitForTimeout(1200);
  await expect(page).toHaveURL(new RegExp(`/quest/${QUEST_COPY}`));

  // Inject encounter state — Grognak defeated by linters_bane
  await page.evaluate(
    ({ questId }) => {
      const store = (window as Record<string, unknown>)['__encounterStore'] as
        | { getState: () => { handleAgentEvent: (qid: string, ev: unknown) => void } }
        | undefined;
      store?.getState().handleAgentEvent(questId, {
        type: 'monster_appeared',
        encounterId: 'enc-grognak-tess',
        monsterId: 'grognak-the-lint-goblin',
        monsterName: 'Grognak the Lint Goblin',
        monsterTypeId: 'goblin_linter',
        difficulty: 2,
        spritePath: '/sprites/monsters/goblin.png',
        timestamp: new Date().toISOString(),
      });
    },
    { questId: QUEST_COPY },
  );
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step-05-tess-grognak-goblin.png'), fullPage: false });

  // ------------------------------------------------------------------
  // STEP 6: Rook quest — fresh Imp encounter (wraith_banisher defeats it)
  // ------------------------------------------------------------------
  const rookMeterActive = { ...MOCK_QUESTS_ACTIVE[2], currentScene: 'quest-forest' };
  await page.route(`**/quests/${QUEST_METER}`, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(rookMeterActive) }),
  );

  await page.goto(`/quest/${QUEST_METER}`);
  await page.waitForTimeout(1200);
  await expect(page).toHaveURL(new RegExp(`/quest/${QUEST_METER}`));

  await page.evaluate(
    ({ questId }) => {
      const store = (window as Record<string, unknown>)['__encounterStore'] as
        | { getState: () => { handleAgentEvent: (qid: string, ev: unknown) => void } }
        | undefined;
      store?.getState().handleAgentEvent(questId, {
        type: 'monster_appeared',
        encounterId: 'enc-imp-rook',
        monsterId: 'imp-of-type-errors',
        monsterName: 'Imp of Type Errors',
        monsterTypeId: 'imp_typecheck',
        difficulty: 2,
        spritePath: '/sprites/monsters/imp.png',
        timestamp: new Date().toISOString(),
      });
    },
    { questId: QUEST_METER },
  );
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step-06-rook-imp-encounter.png'), fullPage: false });

  // ------------------------------------------------------------------
  // STEP 7: Brielle quest — PAUSED_INPUT modal (JWT library question)
  // ------------------------------------------------------------------
  const brielleJwtActive = { ...MOCK_QUESTS_ACTIVE[0], currentScene: 'quest-dungeon' };
  await page.route(`**/quests/${QUEST_JWT}`, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(brielleJwtActive) }),
  );

  await page.goto(`/quest/${QUEST_JWT}`);
  await page.waitForTimeout(1200);
  await expect(page).toHaveURL(new RegExp(`/quest/${QUEST_JWT}`));

  await page.evaluate(
    ({ questId }) => {
      const store = (window as Record<string, unknown>)['__questStore'] as
        | { getState: () => { setStatus: (qid: string, s: string) => void; setInputRequest: (qid: string, r: unknown) => void } }
        | undefined;
      store?.getState().setStatus(questId, 'paused_input');
      store?.getState().setInputRequest(questId, {
        question: 'Which JWT library should I use — jose or jsonwebtoken? The ADR mentions both but does not specify.',
        awaitingSince: new Date().toISOString(),
      });
    },
    { questId: QUEST_JWT },
  );
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step-07-brielle-paused-input.png'), fullPage: false });

  // ------------------------------------------------------------------
  // STEP 8: Brielle's quest failed → Hall of Returns
  // ------------------------------------------------------------------
  await page.route(`**/hall-of-returns/quests?**`, (route) => {
    const url = route.request().url();
    if (url.includes('status=complete')) {
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [], nextCursor: null }) });
    } else {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ items: [MOCK_JWT_FAILED], nextCursor: null }),
      });
    }
  });
  await page.route(`**/hall-of-returns/quests/${QUEST_JWT}/post-mortem`, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_POST_MORTEM_JWT) }),
  );

  await page.goto('/town/hall-of-returns');
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);
  await expect(page.getByText(/Migrate to JWT/i)).toBeVisible();
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step-08-hall-of-returns-returned.png'), fullPage: false });

  // ------------------------------------------------------------------
  // STEP 9: Re-post panel — equip type_whisperer, re-dispatch
  // ------------------------------------------------------------------
  const returnedQuestLink = page.getByRole('link', { name: /migrate to jwt/i })
    .or(page.getByText(/migrate to jwt/i).first());
  const isVisible = await returnedQuestLink.isVisible().catch(() => false);
  if (isVisible) {
    await returnedQuestLink.click();
    await page.waitForTimeout(500);
  }
  await expect(page).toHaveURL(/\/town\/hall-of-returns/);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step-09-repost-panel.png'), fullPage: false });

  // ------------------------------------------------------------------
  // STEP 10: Brielle's second attempt — quest complete, victory fanfare
  // ------------------------------------------------------------------
  await page.route(`**/quests/${QUEST_JWT_REPOST}`, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_JWT_REPOST) }),
  );

  await page.goto(`/quest/${QUEST_JWT_REPOST}`);
  await page.waitForTimeout(1200);
  await expect(page).toHaveURL(new RegExp(`/quest/${QUEST_JWT_REPOST}`));

  await page.evaluate(
    ({ questId }) => {
      const store = (window as Record<string, unknown>)['__questStore'] as
        | { getState: () => { setStatus: (qid: string, s: string) => void } }
        | undefined;
      store?.getState().setStatus(questId, 'complete');
    },
    { questId: QUEST_JWT_REPOST },
  );
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step-10-brielle-victory.png'), fullPage: false });

  // ------------------------------------------------------------------
  // STEP 11: Library — ac_cartographer skill candidate
  // ------------------------------------------------------------------
  await page.goto('/town/library');
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);
  await expect(page).toHaveURL(/\/town\/library/);

  // Click the Skills tab if it exists
  const skillsTab = page.getByRole('tab', { name: /skills/i });
  const skillsTabVisible = await skillsTab.isVisible().catch(() => false);
  if (skillsTabVisible) {
    await skillsTab.click();
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step-11-library-skill-candidate.png'), fullPage: false });

  // ------------------------------------------------------------------
  // STEP 12: Hall of Returns — all 3 quests complete, final summary
  // ------------------------------------------------------------------
  await page.route(`**/hall-of-returns/quests?**`, (route) => {
    const url = route.request().url();
    if (url.includes('status=returned_to_town') || (!url.includes('status=') && !url.includes('status=complete'))) {
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [], nextCursor: null }) });
    } else {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ items: MOCK_FINAL_COMPLETED, nextCursor: null }),
      });
    }
  });

  await page.goto('/town/hall-of-returns');
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);
  await expect(page).toHaveURL(/\/town\/hall-of-returns/);

  // Switch to Completed tab
  const completedTab = page.getByRole('tab', { name: /completed/i });
  const completedTabVisible = await completedTab.isVisible().catch(() => false);
  if (completedTabVisible) {
    await completedTab.click();
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step-12-hall-of-returns.png'), fullPage: false });
});
