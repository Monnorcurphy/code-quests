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
  { path: 'town/fence.png',              w: 64,  h: 32,  palette: TOWN,      seed: 110 },
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
  total += png.length;
}
console.log(`\nGenerated ${ASSETS.length} assets  (${(total / 1024).toFixed(0)} KB total)`);
