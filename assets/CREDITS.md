# Asset Credits

All third-party art and audio assets used in Code Quests are recorded here.
Only CC0 and CC-BY assets are permitted (no CC-NC or commercial-license art).

---

## Kenney Tiny Town

| Field | Value |
|-------|-------|
| **Pack** | Tiny Town |
| **Creator** | Kenney (kenney.nl) |
| **Version** | 1.2 |
| **License** | CC0 1.0 Universal (public domain) |
| **Source** | https://kenney.nl/assets/tiny-town |
| **Attribution required** | No |

**Files:**
- `town/ground-grass.png`
- `town/ground-dirt.png`
- `town/ground-stone.png`
- `town/building-house.png`
- `town/building-shop.png`
- `town/building-tavern.png`
- `town/building-church.png`
- `town/tree-large.png`
- `town/tree-small.png`
- `town/fence.png`
- `town/path.png`

---

## Kenney 1-Bit Pack

| Field | Value |
|-------|-------|
| **Pack** | 1-Bit Pack |
| **Creator** | Kenney (kenney.nl) |
| **Version** | 1.0 |
| **License** | CC0 1.0 Universal (public domain) |
| **Source** | https://kenney.nl/assets/1-bit-pack |
| **Attribution required** | No |

**Files:**
- `character/adventurer-idle.png`
- `character/adventurer-walk.png`
- `character/adventurer-attack.png`
- `character/npc-villager.png`

---

## Kenney Tiny Dungeon

| Field | Value |
|-------|-------|
| **Pack** | Tiny Dungeon |
| **Creator** | Kenney (kenney.nl) |
| **Version** | 1.0 |
| **License** | CC0 1.0 Universal (public domain) |
| **Source** | https://kenney.nl/assets/tiny-dungeon |
| **Attribution required** | No |

**Files:**
- `dungeon/kenney-wall.png`
- `dungeon/kenney-floor.png`
- `dungeon/kenney-door.png`
- `dungeon/kenney-prop.png`

---

## 0x72 Dungeon Tileset II

| Field | Value |
|-------|-------|
| **Pack** | Dungeon Tileset II |
| **Creator** | 0x72 |
| **Version** | 1.6.4 |
| **License** | CC-BY 4.0 |
| **Source** | https://0x72.itch.io/dungeontileset-ii |
| **Attribution required** | Yes — "Dungeon Tileset II" by 0x72 |

**Files:**
- `dungeon/tileset.png`

**Required attribution text:**  
> Dungeon Tileset II by 0x72 — https://0x72.itch.io/dungeontileset-ii — CC-BY 4.0

---

## Phase 5 — Quest scenes

### Kenney Nature Platformer (backgrounds, ground tiles, forest props)

| Field | Value |
|-------|-------|
| **Pack** | Nature Platformer |
| **Creator** | Kenney (kenney.nl) |
| **License** | CC0 1.0 Universal (public domain) |
| **Source** | https://kenney.nl/assets/nature-platformer |
| **Attribution required** | No |

**Files:**
- `quest/bg-forest.png` — forest parallax background
- `quest/ground-forest.png` — forest ground tile
- `quest/prop-forest-tree.png` — forest tree prop

---

### Kenney Tiny Dungeon extended (cave and dungeon quest assets)

| Field | Value |
|-------|-------|
| **Pack** | Tiny Dungeon (extended) |
| **Creator** | Kenney (kenney.nl) |
| **License** | CC0 1.0 Universal (public domain) |
| **Source** | https://kenney.nl/assets/tiny-dungeon |
| **Attribution required** | No |

**Files:**
- `quest/bg-cave.png` — cave parallax background
- `quest/bg-dungeon.png` — dungeon corridor parallax background
- `quest/ground-cave.png` — cave ground tile
- `quest/ground-dungeon.png` — dungeon ground tile
- `quest/prop-cave-rock.png` — cave rock prop
- `quest/prop-dungeon-pillar.png` — dungeon pillar prop

---

### 0x72 Dungeon Tileset II — boss room assets

| Field | Value |
|-------|-------|
| **Pack** | Dungeon Tileset II |
| **Creator** | 0x72 |
| **Version** | 1.6.4 |
| **License** | CC-BY 4.0 |
| **Source** | https://0x72.itch.io/dungeontileset-ii |
| **Attribution required** | Yes — "Dungeon Tileset II" by 0x72 |

**Files:**
- `quest/bg-boss-room.png` — boss chamber parallax background
- `quest/ground-boss.png` — boss chamber ground tile
- `quest/prop-boss-throne.png` — boss throne prop

**Required attribution text:**
> Dungeon Tileset II by 0x72 — https://0x72.itch.io/dungeontileset-ii — CC-BY 4.0

---

### Kenney 1-Bit Pack — monster silhouettes

| Field | Value |
|-------|-------|
| **Pack** | 1-Bit Pack |
| **Creator** | Kenney (kenney.nl) |
| **License** | CC0 1.0 Universal (public domain) |
| **Source** | https://kenney.nl/assets/1-bit-pack |
| **Attribution required** | No |

**Files:**
- `quest/silhouette-monster-small.png` — small monster silhouette (RGBA, with transparency)
- `quest/silhouette-monster-large.png` — large monster silhouette (RGBA, with transparency)

---

## Phase 6 — Monster Sprites

### Kenney 1-Bit Pack — monster glyphs

| Field | Value |
|-------|-------|
| **Pack** | 1-Bit Pack |
| **Creator** | Kenney (kenney.nl) |
| **Version** | 1.0 |
| **License** | CC0 1.0 Universal (public domain) |
| **Source** | https://kenney.nl/assets/1-bit-pack |
| **Attribution required** | No |

**Files:**
- `monsters/goblin.png` — Goblin sprite (difficulty 1, lint errors)
- `monsters/imp.png` — Imp sprite (difficulty 2, type errors)
- `monsters/wraith.png` — Wraith sprite (difficulty 3, flaky tests)
- `monsters/ogre.png` — Ogre sprite (difficulty 3, failing tests)
- `monsters/hydra.png` — Hydra sprite (difficulty 4, AC mismatches)
- `monsters/mimic.png` — Mimic sprite (difficulty 4, silent failures)
- `monsters/wizard.png` — Wizard sprite (difficulty 3, env/dep errors)
- `monsters/troll.png` — Troll sprite (difficulty 4, build failures)
- `monsters/lich.png` — Lich sprite (difficulty 5, repeated failures)
- `monsters/dragon.png` — Dragon sprite (difficulty 5, epic obstacles)

---

## Notes

- Assets marked CC0 require no attribution but are acknowledged here for provenance.
- Assets marked CC-BY require the attribution text above to appear in the app's credits screen.
- `assets/manifest.json` is the machine-readable equivalent used by CI checks.
- Current PNG files are synthetic stubs generated by `scripts/gen-asset-stubs.mjs`.
  Replace them with the real packs downloaded from the sources listed above when preparing a release build.
- Phase 5 background stubs are 256×64 px; real assets must be ≥ 2400×720 px (parallax-ready).
  Silhouette stubs are RGBA with real transparency — replace the shape with real sprite art from the 1-Bit Pack.
