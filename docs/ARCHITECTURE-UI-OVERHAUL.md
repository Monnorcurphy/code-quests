# UI Overhaul — Architecture Notes

Living document tracking the design choices behind the current visual / UX
pass on Town and the building interiors.

## 1. Procedural assets pipeline

All character/monster/decor art is generated at boot time via
Phaser.GameObjects.Graphics → generateTexture, stored under the same texture
keys the asset PNGs would have used. See
`packages/client/src/game/procedural-sprites.ts`.

Why: Kenney pack download URLs returned 404. Procedural drawing keeps the
visuals 100% local, no external rights concern, and lets us programmatically
vary per-adventurer style (see §4).

Trade-off: art is "code chiseled," not pixel-pushed by an artist. Quality
ceiling is lower than a real pack — but quality floor is far higher than the
checkerboard stubs we shipped with.

## 2. Scene draw layering convention

| Depth | What |
|---|---|
| -10 | Sky bands |
| -9, -8 | Distant hills (two layers, parallax-ready) |
| -2 | Building facades behind doors |
| -1 | Grass strip / interior wall texture |
| 0   | Doors, structural decor (bookshelves, anvil, hearth) |
| 1   | Foreground decor (planks, bands, books) |
| 2   | Interactive sprite bodies (clickable) |
| 3   | Interactive labels |
| 4   | NPCs (Guide, Wanderers) — drawn over decor but under modals |
| 5+  | Speech bubbles, particle effects |
| 10+ | React HUD overlay (in DOM, not Phaser) |

`BaseTownScene.isOutdoor` (default true, overridden to false in
`BaseBuildingScene`) gates the sky/hills/facade pass so interiors don't have
a dawn sky behind their walls.

## 3. Per-building palette (single source of truth — TODO)

Today each building scene picks its own background color independently and
the facade textures pick their own colors independently. They drift.

Proposed: a `BUILDING_PALETTES: Record<TownSceneKey, BuildingPalette>` const
in a shared module. Each scene + facade reads from it:

```ts
interface BuildingPalette {
  wall: number;
  wallDark: number;
  roof: number;
  roofDark: number;
  window: number;
  trim?: number;
  interiorBg: string; // CSS color (camera bg)
  accent: number;     // titles, key decor
}

export const BUILDING_PALETTES: Record<TownSceneKey, BuildingPalette> = {
  'war-room': { wall: 0x807068, wallDark: 0x504640, ... },
  'oracle':   { wall: 0xb8a8d0, wallDark: 0x806890, ... },
  ...
};
```

This is a follow-up refactor. Each scene already has these colors hard-coded;
just needs to be pulled out and consumed in two places (facade draw +
interior scene create).

## 4. Doors attached to buildings (refactor design)

Today: Door is a free-floating entity at scene level. Facade is a separate
sprite drawn behind it. Their positions can drift if either side changes.

Proposed: a `Building` entity that composes the two.

```ts
class Building {
  constructor(scene, opts: {
    x: number;
    sceneKey: TownSceneKey;
    targetSpawnX: number;
    palette: BuildingPalette;
  }) {
    this.facade = scene.add.image(x, FACADE_Y, `town-facade-${sceneKey}`);
    this.door   = new Door(scene, { x, y: DOOR_Y, ... });
    this.sign   = scene.add.text(x, SIGN_Y, palette.name, SIGN_STYLE);
  }
  update(playerX) { this.door.update(playerX); }
  destroy() { ... }
}
```

TownSquareScene replaces its `doors.map` with `buildings.map`. The 7
buildings then render as visually unified objects.

## 5. NPCs per building

Each interior scene has one named NPC who explains the building's purpose:

| Building | NPC |
|---|---|
| Town Square | Elder Hawthorne (existing — opens Help modal) |
| Library | Sage Mireldine |
| Oracle | Seer Caelis |
| Tavern | Innkeep Rorek |
| War Room | Commander Tyra |
| Armory | Smith Bran |
| Guild Hall | Master Eldra |
| Hall of Returns | Keeper Vorn |

Each NPC reuses `GuideNpc` pattern: sprite + speech bubble + click handler.
Click opens that building's main modal (the same modal the main interactive
opens). No new modal types — speech bubble carries the role text.

## 6. Adventurer styling (`style_json` design)

Goal: each adventurer is visually distinct, and the user can customize from
Guild Hall.

### Schema

Add `style_json` TEXT column to `adventurers` table:

```sql
ALTER TABLE adventurers ADD COLUMN style_json TEXT NOT NULL DEFAULT '{}';
```

JSON shape (all fields optional, defaults applied at render):

```ts
interface AdventurerStyle {
  skin?:    'fair' | 'olive' | 'tan' | 'brown' | 'dark';
  hair?:    'brown' | 'blonde' | 'black' | 'red' | 'silver' | 'white';
  hairStyle?: 'short' | 'long' | 'bald';
  tunic?:   'green' | 'blue' | 'red' | 'gold' | 'purple' | 'brown';
  accent?:  number;  // optional belt/cape color hex
}
```

### Rendering

`procedural-sprites.generateAdventurerVariant(style)` returns a `PaletteSpec`.
Each new adventurer gets a texture key `adventurer-${id}-idle`,
`adventurer-${id}-walk`, generated once on first render and cached.

### UI

Wardrobe panel in Guild Hall modal: pick an adventurer → see preview → cycle
skin/hair/tunic options → save. Save calls
`PATCH /adventurers/:id { style }` which the server validates against the
union types above.

### Migration

- `0040_adventurer_style.sql` adds the column with DEFAULT '{}'
- Existing adventurers continue to use the default palette
- Newly recruited adventurers get a random style (server picks from the
  union options on create)

This is a follow-up. Out of scope for the current UI overhaul.

## 7. Wandering idle adventurers (architecture)

Idle = adventurer with no quest in {active, paused_input, user_blocked}.

Flow:
1. React: useQuery for adventurers + quests, derive idle list, push to
   `useWanderersStore`.
2. Phaser TownSquareScene subscribes to the store. For each idle adventurer
   not already represented as a `WanderingAdventurer`, spawn one.
3. Each `WanderingAdventurer` has:
   - sprite (will use per-adventurer texture once §6 lands; today shared)
   - random walk timer (turn around every 4-8s)
   - speech timer (every 12-30s show a random catchphrase for 4s)
   - bounds (don't cross into the spawn-area / Quest Board area)
4. Despawn when the adventurer is dispatched (store update) or scene shutdown.

Cap: 6 wanderers on screen even if more idle adventurers exist (just take
the first 6 by ID).

## 8. Hall of Returns bug (suspected root cause)

The `/quests/returned` endpoint returns 200 with a valid payload, but the
React Query throws "Could not load quests." Likely culprits in priority order:

1. **Zod schema mismatch**: server response has a field the client schema
   forbids (extra field), or omits a field the client expects (`required` mismatch).
2. **Date field parsing**: server returns ISO strings, client schema expects
   `Date` or vice versa.
3. **`items` vs root array**: server returns `{ items: [...], total: N }`,
   client schema expects bare `[...]` (or vice versa).

A sub-agent is on this. Most likely fix: a 1-3 line schema correction.

## 9. Testing strategy

- **Unit tests** for entities (`Door`, `Player`, `GuideNpc`, future
  `Building`, `WanderingAdventurer`) using Phaser mocks. Mock surface
  area documented in `packages/client/src/game/scenes/__tests__/all-buildings.test.ts`
  `makeRect`/`makeSprite`/scene shape — keep these stubs synchronized with
  new render methods (recent regressions: missing `circle`, `line`,
  `triangle`, `setLineWidth`, `setDisplaySize`, `tweens.add`).
- **Integration tests** for the React side via React Testing Library + msw
  for mock server. Cover: each modal opens, each form submits, error states
  render.
- **Playwright E2E** for click-flow: walk town → click each door → modal opens.
  The bot's existing `all-buildings.spec.ts` assumes Phase 2 placeholder
  behavior and is stale — rewrite, don't patch.

---

This document evolves as decisions are made or revised.
