/**
 * Generates synthetic but valid pixel-art-style PNG stub assets.
 * Each output is ≥1KB, has varied pixel data, and is structured per-asset.
 *
 * Run with: node scripts/gen-asset-stubs.mjs
 *
 * These stubs satisfy the CI pipeline while the project is bootstrapped.
 * Replace with real Kenney/0x72 downloads when available.
 */

import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(fileURLToPath(import.meta.url), '../..');

// ── CRC32 ──────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([len, typeBytes, data, crcBuf]);
}

// ── PNG builder ────────────────────────────────────────────────────────────

/**
 * Builds a valid RGB PNG with a pixel-art-like pattern derived from the
 * given palette.  The LCG seed ensures each image is visually distinct.
 */
function makePNG(width, height, palette, seed) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type: truecolor RGB

  let s = seed >>> 0;
  function lcg() {
    s = ((Math.imul(s, 1664525) + 1013904223) | 0) >>> 0;
    return s;
  }

  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    row[0] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const r1 = lcg();
      const r2 = lcg();
      const tileX = x >> 3;
      const tileY = y >> 3;
      const ci = (tileX ^ tileY ^ (r1 & 3)) % palette.length;
      const [pr, pg, pb] = palette[ci];
      const noise = ((r2 >> 8) & 0x1f) - 16;
      row[1 + x * 3 + 0] = Math.max(0, Math.min(255, pr + noise));
      row[1 + x * 3 + 1] = Math.max(0, Math.min(255, pg + noise));
      row[1 + x * 3 + 2] = Math.max(0, Math.min(255, pb + noise));
    }
    rows.push(row);
  }

  const raw = Buffer.concat(rows);
  const compressed = deflateSync(raw, { level: 6 });

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdrData),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Builds a valid RGBA PNG where shapeFn(x, y) determines pixel visibility.
 * Pixels outside the shape have alpha=0; inside pixels are fully opaque.
 * Used for monster silhouettes — requires transparency.
 */
function makePNGRGBA(width, height, palette, seed, shapeFn) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type: truecolor RGBA

  let s = seed >>> 0;
  function lcg() {
    s = ((Math.imul(s, 1664525) + 1013904223) | 0) >>> 0;
    return s;
  }

  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const r1 = lcg();
      const r2 = lcg();
      const visible = shapeFn(x, y);
      if (visible) {
        const tileX = x >> 3;
        const tileY = y >> 3;
        const ci = (tileX ^ tileY ^ (r1 & 3)) % palette.length;
        const [pr, pg, pb] = palette[ci];
        const noise = ((r2 >> 8) & 0x0f) - 8;
        row[1 + x * 4 + 0] = Math.max(0, Math.min(255, pr + noise));
        row[1 + x * 4 + 1] = Math.max(0, Math.min(255, pg + noise));
        row[1 + x * 4 + 2] = Math.max(0, Math.min(255, pb + noise));
        row[1 + x * 4 + 3] = 255;
      }
      // transparent pixels remain 0,0,0,0
    }
    rows.push(row);
  }

  const raw = Buffer.concat(rows);
  const compressed = deflateSync(raw, { level: 6 });

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdrData),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Palettes ──────────────────────────────────────────────────────────────

const TOWN = [
  [139, 90, 43], [160, 110, 60], [100, 180, 50], [80, 150, 40],
  [200, 180, 120], [150, 130, 100], [200, 80, 50], [50, 100, 200],
  [230, 200, 100], [180, 60, 30], [60, 120, 60], [80, 160, 80],
];

const DUNGEON = [
  [60, 50, 40], [80, 70, 60], [40, 35, 30], [90, 80, 70],
  [120, 100, 80], [20, 20, 20], [200, 150, 50], [100, 30, 30],
  [50, 80, 120], [150, 120, 80],
];

const CHARACTER = [
  [50, 50, 180], [200, 180, 140], [80, 60, 30], [200, 200, 200],
  [150, 30, 30], [230, 200, 50], [60, 60, 60], [0, 0, 0],
];

// Quest biome palettes
const FOREST = [
  [34, 85, 34],  [50, 120, 50],  [70, 150, 40],  [100, 180, 60],
  [20, 60, 20],  [160, 200, 80], [80, 55, 20],   [110, 75, 30],
  [60, 170, 200],[200, 230, 240],[140, 200, 120], [180, 130, 60],
];

const CAVE = [
  [30, 28, 35],  [50, 45, 55],  [70, 65, 75],  [20, 18, 25],
  [90, 85, 100], [40, 50, 80],  [60, 70, 100], [15, 15, 20],
  [80, 60, 40],  [100, 90, 110],
];

const DUNGEON_QUEST = [
  [55, 50, 45],  [75, 70, 60],  [45, 40, 35],  [95, 85, 70],
  [110, 90, 70], [180, 120, 40],[200, 140, 50], [30, 25, 20],
  [60, 55, 50],  [140, 100, 60],[80, 40, 20],   [120, 100, 80],
];

const BOSS = [
  [30, 10, 40],  [50, 20, 60],  [20, 8, 30],   [70, 30, 80],
  [180, 140, 20],[200, 160, 30],[140, 100, 10], [10, 5, 15],
  [80, 20, 20],  [100, 30, 30], [60, 60, 60],   [40, 40, 50],
];

const SILHOUETTE = [
  [20, 18, 22],  [30, 25, 32],  [15, 12, 18],  [25, 20, 28],
];

// ── Silhouette shape functions ─────────────────────────────────────────────

// Small monster (48×64): goblin-like humanoid silhouette
function smallMonsterShape(x, y) {
  // Head (centered, top area)
  if (x >= 16 && x < 32 && y >= 2 && y < 18) return true;
  // Body
  if (x >= 12 && x < 36 && y >= 18 && y < 36) return true;
  // Left arm
  if (x >= 4 && x < 12 && y >= 18 && y < 30) return true;
  // Right arm
  if (x >= 36 && x < 44 && y >= 18 && y < 30) return true;
  // Left leg
  if (x >= 12 && x < 22 && y >= 36 && y < 54) return true;
  // Right leg
  if (x >= 26 && x < 36 && y >= 36 && y < 54) return true;
  return false;
}

// Large monster (64×96): troll-like imposing silhouette
function largeMonsterShape(x, y) {
  // Head (wider, top area)
  if (x >= 20 && x < 44 && y >= 4 && y < 24) return true;
  // Horns (small protrusions above head)
  if (x >= 20 && x < 26 && y >= 0 && y < 6) return true;
  if (x >= 38 && x < 44 && y >= 0 && y < 6) return true;
  // Body (wide, stocky)
  if (x >= 8 && x < 56 && y >= 24 && y < 60) return true;
  // Left arm (extends far left, thick)
  if (x >= 0 && x < 8 && y >= 24 && y < 52) return true;
  // Right arm (extends far right, thick)
  if (x >= 56 && x < 64 && y >= 24 && y < 52) return true;
  // Left leg
  if (x >= 8 && x < 28 && y >= 60 && y < 88) return true;
  // Right leg
  if (x >= 36 && x < 56 && y >= 60 && y < 88) return true;
  return false;
}

// ── Asset list ────────────────────────────────────────────────────────────

const ASSETS = [
  // Kenney Tiny Town (CC0)
  { path: 'town/ground-grass.png',       w: 64,  h: 64,  palette: TOWN,      seed: 101 },
  { path: 'town/ground-dirt.png',        w: 64,  h: 64,  palette: TOWN,      seed: 102 },
  { path: 'town/ground-stone.png',       w: 64,  h: 64,  palette: TOWN,      seed: 103 },
  { path: 'town/building-house.png',     w: 64,  h: 96,  palette: TOWN,      seed: 104 },
  { path: 'town/building-shop.png',      w: 64,  h: 96,  palette: TOWN,      seed: 105 },
  { path: 'town/building-tavern.png',    w: 64,  h: 128, palette: TOWN,      seed: 106 },
  { path: 'town/building-church.png',    w: 64,  h: 128, palette: TOWN,      seed: 107 },
  { path: 'town/tree-large.png',         w: 48,  h: 80,  palette: TOWN,      seed: 108 },
  { path: 'town/tree-small.png',         w: 32,  h: 48,  palette: TOWN,      seed: 109 },
  { path: 'town/fence.png',             w: 64,  h: 32,  palette: TOWN,      seed: 110 },
  { path: 'town/path.png',               w: 64,  h: 64,  palette: TOWN,      seed: 111 },
  // Kenney 1-Bit Pack (CC0)
  { path: 'character/adventurer-idle.png',   w: 48, h: 48, palette: CHARACTER, seed: 201 },
  { path: 'character/adventurer-walk.png',   w: 96, h: 48, palette: CHARACTER, seed: 202 },
  { path: 'character/adventurer-attack.png', w: 96, h: 48, palette: CHARACTER, seed: 203 },
  { path: 'character/npc-villager.png',      w: 48, h: 48, palette: CHARACTER, seed: 204 },
  // Kenney Tiny Dungeon (CC0)
  { path: 'dungeon/kenney-wall.png',     w: 64,  h: 64,  palette: DUNGEON,   seed: 302 },
  { path: 'dungeon/kenney-floor.png',    w: 64,  h: 64,  palette: DUNGEON,   seed: 303 },
  { path: 'dungeon/kenney-door.png',     w: 64,  h: 128, palette: DUNGEON,   seed: 304 },
  { path: 'dungeon/kenney-prop.png',     w: 64,  h: 64,  palette: DUNGEON,   seed: 305 },
  // 0x72 Dungeon Tileset II (CC-BY)
  { path: 'dungeon/tileset.png',         w: 256, h: 256, palette: DUNGEON,   seed: 301 },
  // ── Phase 5 Quest scene assets ──────────────────────────────────────────
  // Kenney Nature Platformer (CC0) — backgrounds + ground + forest props (stubs)
  { path: 'quest/bg-forest.png',         w: 256, h: 64,  palette: FOREST,      seed: 401 },
  { path: 'quest/bg-cave.png',           w: 256, h: 64,  palette: CAVE,        seed: 402 },
  { path: 'quest/bg-dungeon.png',        w: 256, h: 64,  palette: DUNGEON_QUEST, seed: 403 },
  { path: 'quest/bg-boss-room.png',      w: 256, h: 64,  palette: BOSS,        seed: 404 },
  { path: 'quest/prop-forest-tree.png',  w: 48,  h: 80,  palette: FOREST,      seed: 411 },
  { path: 'quest/prop-cave-rock.png',    w: 64,  h: 48,  palette: CAVE,        seed: 412 },
  { path: 'quest/prop-dungeon-pillar.png', w: 32, h: 96, palette: DUNGEON_QUEST, seed: 413 },
  { path: 'quest/prop-boss-throne.png',  w: 80,  h: 96,  palette: BOSS,        seed: 414 },
  { path: 'quest/ground-forest.png',     w: 64,  h: 32,  palette: FOREST,      seed: 421 },
  { path: 'quest/ground-cave.png',       w: 64,  h: 32,  palette: CAVE,        seed: 422 },
  { path: 'quest/ground-dungeon.png',    w: 64,  h: 32,  palette: DUNGEON_QUEST, seed: 423 },
  { path: 'quest/ground-boss.png',       w: 64,  h: 32,  palette: BOSS,        seed: 424 },
];

// RGBA assets (require transparency — must be listed separately)
const RGBA_ASSETS = [
  // Kenney 1-Bit Pack (CC0) — monster silhouettes with transparency
  {
    path: 'quest/silhouette-monster-small.png',
    w: 48, h: 64, palette: SILHOUETTE, seed: 431,
    shapeFn: smallMonsterShape,
  },
  {
    path: 'quest/silhouette-monster-large.png',
    w: 64, h: 96, palette: SILHOUETTE, seed: 432,
    shapeFn: largeMonsterShape,
  },
];

// ── Generate ──────────────────────────────────────────────────────────────

let total = 0;

for (const { path, w, h, palette, seed } of ASSETS) {
  const dest = join(ROOT, 'assets', path);
  mkdirSync(dirname(dest), { recursive: true });
  const png = makePNG(w, h, palette, seed);
  writeFileSync(dest, png);
  const kb = (png.length / 1024).toFixed(1);
  console.log(`  assets/${path}  (${w}×${h}, ${kb} KB)`);
  if (png.length < 1024) {
    console.error(`  ERROR: ${path} is less than 1KB!`);
    process.exit(1);
  }
  if (png.length > 512 * 1024) {
    console.error(`  ERROR: ${path} exceeds 500KB!`);
    process.exit(1);
  }
  total += png.length;
}

for (const { path, w, h, palette, seed, shapeFn } of RGBA_ASSETS) {
  const dest = join(ROOT, 'assets', path);
  mkdirSync(dirname(dest), { recursive: true });
  const png = makePNGRGBA(w, h, palette, seed, shapeFn);
  writeFileSync(dest, png);
  const kb = (png.length / 1024).toFixed(1);
  console.log(`  assets/${path}  (${w}×${h} RGBA, ${kb} KB)`);
  if (png.length < 1024) {
    console.error(`  ERROR: ${path} is less than 1KB!`);
    process.exit(1);
  }
  if (png.length > 512 * 1024) {
    console.error(`  ERROR: ${path} exceeds 500KB!`);
    process.exit(1);
  }
  total += png.length;
}

const allCount = ASSETS.length + RGBA_ASSETS.length;
console.log(`\nGenerated ${allCount} assets  (${(total / 1024).toFixed(0)} KB total)`);
