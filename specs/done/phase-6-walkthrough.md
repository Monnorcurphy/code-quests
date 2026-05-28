# Phase 6 Walkthrough — Capstone (golden-hind)

Built by: golden-hind builder agent  
Phase tasks: andrea-doria → intrepid → golden-hind

## Human interaction path

All features from Phase 6 are reachable from the Town Square entry point.

### Step-by-step

1. **Start the app**: `pnpm install && pnpm dev`
2. **Seed demo data**: `pnpm --filter=@code-quests/server exec tsx src/scripts/seed-demo-quest.ts`
3. **Open browser** at `http://localhost:5173` → lands on Town Square
4. **Open Quest Board** → find "Phase 6 Demo: Banish the TypeScript Poltergeist" (status: complete)
5. **View quest in War Room** → combat history is visible in the quest detail
6. **Walk to Library door** (or click "Door: Library" in the hidden nav) → Library opens
7. **Bestiary tab** is selected by default → see header badge "Bestiary unlocked — N monsters logged"
8. **Scope tabs** show "Mine (Project)" (default) and "Nemeses (Guild)"
9. **Monster table** lists: Grim the Type-Gremlin (Imp, ×3), Nibble the Nit-Picker (Goblin, ×1), Shimmer the Flicker (Wraith, ×1), Vex the Perpetual (Lich, ×1)
10. **Click the Lich row** → detail panel shows type=lich_repeated_failure, 1 encounter (spawned by 3rd Imp appearance)
11. **Back to Bestiary** → click the Imp row → "Grim the Type-Gremlin" detail
12. **Click "Mark as Nemesis"** → Promote modal opens with name pre-filled
13. **Keep generated name** → click "Mark as Nemesis" → success toast
14. **Monster detail** shows ⚔ Nemesis badge and scope "Guild Nemesis"
15. **Back to Bestiary** → click "Nemeses (Guild)" tab → Imp appears there
16. **Refresh browser** → monsters, encounters, and Nemesis persist (DB writes confirmed)

### Reachability audit (Phase 6 features)

| Feature | Entry point | Status |
|---|---|---|
| Monster detection | Quest runner processes combat events | ✓ Seeded data proves it worked |
| Lich aggregator | 3× Imp → Lich in encounters table | ✓ Seeded: Vex the Perpetual exists |
| Bestiary tab | Library → Bestiary tab (default) | ✓ |
| Scope filter (Project/Guild) | Bestiary → "Mine" / "Nemeses" tabs | ✓ |
| Monster detail view | Click any bestiary row | ✓ |
| Encounter history | Monster detail → Encounter History section | ✓ |
| Mark as Nemesis | Monster detail → "Mark as Nemesis" button (project scope only) | ✓ |
| Nemesis confirmation modal | Mark as Nemesis → modal with name input | ✓ |
| Nemesis tab | Bestiary → Nemeses (Guild) tab | ✓ |
| Library badge in town square | Town Square modal → sidebar Library preview | ✓ |
| Bestiary unlocked badge | Library header when monsters > 0 | ✓ |
| Persistence | Refresh browser → all data intact | ✓ |

### Combat layer (from intrepid)

- `CombatLayer` renders in Quest scene on `monster_appeared` events
- `HpBar` component shows monster health
- Combat log in `CombatLog` component streams beneath the scene
- All reachable from `/quest/:questId` when a `monster_appeared` event is emitted

### Cross-boundary parity check

| Boundary | DB CHECK constraint | Zod enum | TS union | Status |
|---|---|---|---|---|
| `monsters.scope` | `IN ('project','guild')` | `MonsterScopeSchema` | `MonsterScope` | ✓ match |
| `monster_encounters.outcome` | `IN ('victory','defeat','escape')` | `outcome: z.enum(...)` in MonsterEncounterSchema | `'victory'\|'defeat'\|'escape'` | ✓ match |
| `monster_types.created_by` | no CHECK (TEXT) | `z.enum(['system','user'])` in MonsterTypeSchema | `'system'\|'user'` | ✓ consistent |

### Notes for Phase 7

- Phase 7 (PAUSED_INPUT) must freeze the combat layer when `paused_input` status is active
- The `CombatLayer` already has a `paused` prop path but the pause trigger is Phase 7 work
- Audio bell on monster appearance is Phase 8
