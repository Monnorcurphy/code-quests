import Phaser from 'phaser';
import type { AdventurerStyle, TunicColor, HairColor } from '@code-quests/shared';

// Procedurally drawn fantasy sprites. Generated once at boot via Graphics →
// generateTexture, then registered against the same texture keys the rest
// of the game uses. Replaces the checker-pattern placeholder PNGs.
//
// Drawing all happens through Phaser.GameObjects.Graphics, then we extract
// pixels into a named texture. The original PNG files stay on disk but are
// never loaded — addToTextureManager runs after the boot preload phase and
// REGENERATES the texture in the texture manager, overriding whatever was
// loaded.

const PLAYER_W = 32;
const PLAYER_H = 48;

export interface PaletteSpec {
  skin: number;
  skinDark: number;
  hair: number;
  tunic: number;
  tunicDark: number;
  belt: number;
  boots: number;
  bootsDark: number;
  outline: number;
}

// Default fallback palette used when an adventurer has no saved style yet
// and as the basis for derivations (only tunic + hair vary in MVP).
const ADVENTURER_PALETTE: PaletteSpec = {
  skin: 0xf4d0a4,
  skinDark: 0xc99270,
  hair: 0x7a4a18,
  tunic: 0x3d6e3a, // forest green
  tunicDark: 0x254a23,
  belt: 0x5c3a18,
  boots: 0x3c2410,
  bootsDark: 0x1f130a,
  outline: 0x1a0e08,
};

// Tunic color → (base, dark shade) tuple. Dark variant is used for the
// shadow under the hem so the silhouette reads in two tones.
const TUNIC_COLOR_MAP: Record<TunicColor, { base: number; dark: number }> = {
  green: { base: 0x3d6e3a, dark: 0x254a23 },
  blue: { base: 0x2e5a96, dark: 0x183a64 },
  red: { base: 0x9a2828, dark: 0x5c1414 },
  gold: { base: 0xd4a83a, dark: 0x8a6a18 },
  purple: { base: 0x5a3a8a, dark: 0x382258 },
  brown: { base: 0x6a4a28, dark: 0x3c2814 },
};

const HAIR_COLOR_MAP: Record<HairColor, number> = {
  brown: 0x7a4a18,
  blonde: 0xe6c87a,
  black: 0x1a1208,
  red: 0xb04a18,
  silver: 0xc8c8d0,
};

/**
 * Resolve an AdventurerStyle (tunic + hair choices) into a full PaletteSpec.
 * Falls back to the default forest-green / brown-hair look for any unset
 * field so partial styles still render coherently.
 */
export function paletteForStyle(style: AdventurerStyle | undefined): PaletteSpec {
  const tunic = style?.tunic !== undefined ? TUNIC_COLOR_MAP[style.tunic] : null;
  const hair = style?.hair !== undefined ? HAIR_COLOR_MAP[style.hair] : null;
  return {
    ...ADVENTURER_PALETTE,
    tunic: tunic?.base ?? ADVENTURER_PALETTE.tunic,
    tunicDark: tunic?.dark ?? ADVENTURER_PALETTE.tunicDark,
    hair: hair ?? ADVENTURER_PALETTE.hair,
  };
}

export function adventurerTextureKeys(adventurerId: string): {
  idle: string;
  walk: string;
  attack: string;
} {
  return {
    idle: `adv-${adventurerId}-idle`,
    walk: `adv-${adventurerId}-walk`,
    attack: `adv-${adventurerId}-attack`,
  };
}

/**
 * Generate (or regenerate) the three per-adventurer textures keyed by id.
 * Safe to call multiple times — existing textures are replaced.
 */
export function generateAdventurerTextures(
  scene: Phaser.Scene,
  adventurerId: string,
  style: AdventurerStyle | undefined,
): void {
  const palette = paletteForStyle(style);
  const keys = adventurerTextureKeys(adventurerId);
  generateTexture(scene, keys.idle, PLAYER_W, PLAYER_H, (g) =>
    drawAdventurer(g, palette, 'idle'),
  );
  generateTexture(scene, keys.walk, PLAYER_W, PLAYER_H, (g) =>
    drawAdventurer(g, palette, 'walk-a'),
  );
  generateTexture(scene, keys.attack, PLAYER_W, PLAYER_H, (g) =>
    drawAdventurer(g, palette, 'attack'),
  );
}

function drawAdventurer(
  g: Phaser.GameObjects.Graphics,
  palette: PaletteSpec,
  pose: 'idle' | 'walk-a' | 'walk-b' | 'attack',
): void {
  // Outline silhouette first so the pixel art reads cleanly.
  const outline = palette.outline;

  const headCx = 16;
  const headCy = 12;
  const headR = 6;

  // Hair cap
  g.fillStyle(palette.hair);
  g.fillRect(headCx - 6, headCy - 6, 12, 4);
  g.fillRect(headCx - 7, headCy - 5, 2, 3);
  g.fillRect(headCx + 5, headCy - 5, 2, 3);

  // Face
  g.fillStyle(palette.skin);
  g.fillCircle(headCx, headCy, headR);
  g.fillStyle(palette.skinDark);
  g.fillRect(headCx + 3, headCy - 1, 1, 1); // cheek shadow
  g.fillStyle(outline);
  g.fillRect(headCx - 2, headCy - 1, 1, 1); // eye
  g.fillRect(headCx + 2, headCy - 1, 1, 1); // eye

  // Body / tunic
  const bodyY = 19;
  const bodyH = 16;
  g.fillStyle(palette.tunic);
  g.fillRect(headCx - 6, bodyY, 12, bodyH);
  g.fillStyle(palette.tunicDark);
  g.fillRect(headCx - 6, bodyY + bodyH - 3, 12, 3);
  // Belt
  g.fillStyle(palette.belt);
  g.fillRect(headCx - 7, bodyY + bodyH - 2, 14, 2);

  // Arms - pose dependent
  const armY = bodyY + 1;
  g.fillStyle(palette.tunic);
  if (pose === 'attack') {
    // sword arm raised forward
    g.fillRect(headCx + 6, armY - 3, 5, 4);
    g.fillRect(headCx + 10, armY - 5, 2, 2);
    g.fillStyle(0xb0b0b8); // sword blade
    g.fillRect(headCx + 11, armY - 12, 2, 8);
    g.fillStyle(0x6a3a18);
    g.fillRect(headCx + 10, armY - 4, 4, 2);
  } else {
    // arms hanging at sides
    g.fillRect(headCx - 8, armY, 2, 9);
    g.fillRect(headCx + 6, armY, 2, 9);
    g.fillStyle(palette.skin);
    g.fillRect(headCx - 8, armY + 9, 2, 2);
    g.fillRect(headCx + 6, armY + 9, 2, 2);
  }

  // Legs - pose dependent
  const legY = bodyY + bodyH;
  g.fillStyle(palette.boots);
  if (pose === 'walk-a') {
    g.fillRect(headCx - 5, legY, 4, 9);
    g.fillRect(headCx + 1, legY, 4, 9);
    // step offset
    g.fillStyle(palette.bootsDark);
    g.fillRect(headCx - 5, legY + 7, 4, 2);
    g.fillRect(headCx + 1, legY + 5, 4, 2);
  } else if (pose === 'walk-b') {
    g.fillRect(headCx - 5, legY, 4, 9);
    g.fillRect(headCx + 1, legY, 4, 9);
    g.fillStyle(palette.bootsDark);
    g.fillRect(headCx - 5, legY + 5, 4, 2);
    g.fillRect(headCx + 1, legY + 7, 4, 2);
  } else {
    g.fillRect(headCx - 5, legY, 4, 9);
    g.fillRect(headCx + 1, legY, 4, 9);
    g.fillStyle(palette.bootsDark);
    g.fillRect(headCx - 5, legY + 7, 4, 2);
    g.fillRect(headCx + 1, legY + 7, 4, 2);
  }
}

const MONSTER_W = 32;
const MONSTER_H = 32;

interface MonsterSpec {
  body: number;
  bodyDark: number;
  accent: number;
  eyes: number;
  outline: number;
  shape: 'goblin' | 'imp' | 'wraith' | 'ogre' | 'hydra' | 'mimic' | 'wizard' | 'troll' | 'lich' | 'dragon';
}

const MONSTERS: Record<string, MonsterSpec> = {
  'monster-goblin': { body: 0x5a8a3a, bodyDark: 0x3a5e1f, accent: 0x882020, eyes: 0xffeb3b, outline: 0x1a2010, shape: 'goblin' },
  'monster-imp': { body: 0xb22050, bodyDark: 0x6c0e2e, accent: 0xff8c00, eyes: 0xfffacd, outline: 0x180810, shape: 'imp' },
  'monster-wraith': { body: 0x8a8aa8, bodyDark: 0x40406a, accent: 0xc4c8e8, eyes: 0x00ffff, outline: 0x1a1830, shape: 'wraith' },
  'monster-ogre': { body: 0x6a5028, bodyDark: 0x3c2c14, accent: 0x90703a, eyes: 0xaa3030, outline: 0x1a1408, shape: 'ogre' },
  'monster-hydra': { body: 0x2a8a4a, bodyDark: 0x143c20, accent: 0xc0d030, eyes: 0xffeb3b, outline: 0x080f0a, shape: 'hydra' },
  'monster-mimic': { body: 0x6a3a14, bodyDark: 0x3c1f08, accent: 0xff6020, eyes: 0xffeb3b, outline: 0x180a04, shape: 'mimic' },
  'monster-wizard': { body: 0x4a3aaa, bodyDark: 0x281858, accent: 0xfacd2a, eyes: 0xa0c8ff, outline: 0x0e0a30, shape: 'wizard' },
  'monster-troll': { body: 0x4a6a2a, bodyDark: 0x223a12, accent: 0xa07050, eyes: 0xff5050, outline: 0x081a08, shape: 'troll' },
  'monster-lich': { body: 0x303040, bodyDark: 0x101018, accent: 0x9000c0, eyes: 0x40e0ff, outline: 0x040408, shape: 'lich' },
  'monster-dragon': { body: 0xa02828, bodyDark: 0x500e0e, accent: 0xfaa030, eyes: 0xffff60, outline: 0x180404, shape: 'dragon' },
};

function drawMonster(g: Phaser.GameObjects.Graphics, spec: MonsterSpec): void {
  const cx = 16;
  // base body
  g.fillStyle(spec.body);
  switch (spec.shape) {
    case 'goblin':
      // small humanoid with ears
      g.fillRect(cx - 6, 14, 12, 12); // body
      g.fillCircle(cx, 10, 6); // head
      g.fillTriangle(cx - 7, 8, cx - 4, 4, cx - 3, 10); // left ear
      g.fillTriangle(cx + 7, 8, cx + 4, 4, cx + 3, 10);
      g.fillRect(cx - 5, 25, 3, 5); // legs
      g.fillRect(cx + 2, 25, 3, 5);
      break;
    case 'imp':
      g.fillCircle(cx, 14, 8); // round body
      g.fillTriangle(cx - 8, 8, cx - 3, 4, cx - 2, 10); // horn
      g.fillTriangle(cx + 8, 8, cx + 3, 4, cx + 2, 10);
      g.fillTriangle(cx - 11, 18, cx - 4, 20, cx - 7, 14); // wing left
      g.fillTriangle(cx + 11, 18, cx + 4, 20, cx + 7, 14);
      break;
    case 'wraith':
      // ghostly shape — tall flowing
      g.fillRect(cx - 8, 8, 16, 22);
      g.fillCircle(cx, 10, 7);
      g.fillStyle(spec.bodyDark);
      g.fillTriangle(cx - 8, 30, cx, 26, cx - 4, 30);
      g.fillTriangle(cx, 30, cx + 8, 26, cx + 4, 30);
      break;
    case 'ogre':
      g.fillRect(cx - 8, 10, 16, 18); // big body
      g.fillCircle(cx, 8, 5); // small head on big body
      g.fillRect(cx - 6, 28, 4, 4);
      g.fillRect(cx + 2, 28, 4, 4);
      // tusks
      g.fillStyle(0xfff8d8);
      g.fillRect(cx - 2, 9, 1, 2);
      g.fillRect(cx + 1, 9, 1, 2);
      break;
    case 'hydra':
      g.fillRect(cx - 6, 18, 12, 10);
      // three necks
      g.fillRect(cx - 4, 8, 2, 12);
      g.fillCircle(cx - 3, 8, 3);
      g.fillRect(cx + 2, 8, 2, 12);
      g.fillCircle(cx + 3, 8, 3);
      g.fillRect(cx - 1, 6, 2, 14);
      g.fillCircle(cx, 6, 3);
      break;
    case 'mimic':
      // treasure chest with teeth
      g.fillRect(cx - 8, 12, 16, 16);
      g.fillStyle(spec.bodyDark);
      g.fillRect(cx - 8, 12, 16, 4);
      g.fillRect(cx - 8, 24, 16, 4);
      g.fillStyle(spec.accent);
      g.fillRect(cx - 2, 14, 4, 4); // lock
      // teeth
      g.fillStyle(0xfff8d8);
      for (let i = -7; i <= 6; i += 3) {
        g.fillTriangle(cx + i, 16, cx + i + 2, 16, cx + i + 1, 19);
      }
      break;
    case 'wizard':
      // robed figure with pointy hat
      g.fillRect(cx - 6, 16, 12, 14); // robe
      g.fillCircle(cx, 12, 4); // head
      g.fillTriangle(cx - 6, 10, cx + 6, 10, cx, 2); // hat
      g.fillStyle(spec.accent);
      g.fillCircle(cx, 4, 1); // hat star
      break;
    case 'troll':
      g.fillRect(cx - 8, 12, 16, 16);
      g.fillCircle(cx, 10, 5);
      g.fillTriangle(cx - 4, 6, cx - 2, 1, cx, 6); // tuft
      g.fillRect(cx - 5, 28, 3, 4);
      g.fillRect(cx + 2, 28, 3, 4);
      break;
    case 'lich':
      // skeletal robed figure
      g.fillRect(cx - 7, 16, 14, 14);
      g.fillStyle(0xe8e8e8);
      g.fillCircle(cx, 11, 4); // skull
      g.fillStyle(spec.outline);
      g.fillRect(cx - 2, 11, 1, 1);
      g.fillRect(cx + 1, 11, 1, 1);
      g.fillStyle(spec.accent);
      g.fillCircle(cx, 22, 2); // glowing orb
      break;
    case 'dragon':
      // big winged
      g.fillRect(cx - 6, 14, 12, 14);
      g.fillCircle(cx, 14, 5); // head
      g.fillTriangle(cx - 12, 14, cx - 4, 12, cx - 6, 22); // wing left
      g.fillTriangle(cx + 12, 14, cx + 4, 12, cx + 6, 22);
      g.fillStyle(spec.accent);
      g.fillTriangle(cx + 2, 8, cx + 6, 4, cx + 4, 10); // horn
      break;
  }
  // Eyes
  g.fillStyle(spec.eyes);
  if (spec.shape === 'hydra') {
    g.fillRect(cx - 4, 8, 1, 1);
    g.fillRect(cx + 3, 8, 1, 1);
    g.fillRect(cx, 6, 1, 1);
  } else if (spec.shape === 'imp') {
    g.fillRect(cx - 3, 13, 1, 1);
    g.fillRect(cx + 2, 13, 1, 1);
  } else if (spec.shape === 'lich') {
    g.fillStyle(spec.eyes);
    g.fillRect(cx - 2, 11, 1, 1);
    g.fillRect(cx + 1, 11, 1, 1);
  } else if (spec.shape !== 'wraith' && spec.shape !== 'mimic') {
    g.fillRect(cx - 2, 9, 1, 1);
    g.fillRect(cx + 1, 9, 1, 1);
  }
}

/**
 * Generate a procedurally drawn texture under the given key. Replaces any
 * existing texture of the same key (e.g. the loaded checker stub PNG).
 */
function generateTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, width, height);
  g.destroy();
}

// ============================================================================
// Decor: doors, quest board, recruit banner, buildings.
// These are drawn into named textures so scenes can replace their plain
// rectangles with `add.image(x, y, 'tex-door')` etc.
// ============================================================================

const DOOR_W = 64;
const DOOR_H = 96;

function drawDoor(g: Phaser.GameObjects.Graphics): void {
  // Stone arch frame
  g.fillStyle(0x6a6258);
  g.fillRect(0, 4, DOOR_W, DOOR_H - 4);
  g.fillStyle(0x4a4640);
  for (let r = 0; r < 4; r++) {
    g.fillRect(0, 4 + r * 24, 4, 18);
    g.fillRect(DOOR_W - 4, 4 + r * 24, 4, 18);
  }
  // Arch top
  g.fillStyle(0x6a6258);
  g.fillCircle(DOOR_W / 2, 20, 22);
  g.fillRect(8, 20, DOOR_W - 16, 6);
  g.fillStyle(0x4a4640);
  g.fillCircle(DOOR_W / 2, 20, 24);
  g.fillStyle(0x6a6258);
  g.fillCircle(DOOR_W / 2, 20, 22);
  // Door planks
  const doorTop = 22;
  const doorH = DOOR_H - doorTop - 4;
  g.fillStyle(0x6a3e1c);
  g.fillRect(8, doorTop, DOOR_W - 16, doorH);
  // Plank dividers (vertical lines)
  g.fillStyle(0x3c2210);
  for (let x = 16; x < DOOR_W - 12; x += 12) {
    g.fillRect(x, doorTop, 1, doorH);
  }
  // Iron strap hinges
  g.fillStyle(0x2a2a2e);
  g.fillRect(8, doorTop + 6, DOOR_W - 16, 4);
  g.fillRect(8, doorTop + doorH - 12, DOOR_W - 16, 4);
  // Rivets
  g.fillStyle(0x6a6a72);
  for (let x = 12; x < DOOR_W - 10; x += 10) {
    g.fillRect(x, doorTop + 7, 2, 2);
    g.fillRect(x, doorTop + doorH - 11, 2, 2);
  }
  // Handle ring
  g.fillStyle(0x504830);
  g.fillCircle(DOOR_W - 18, doorTop + doorH / 2, 4);
  g.fillStyle(0x9a8a60);
  g.fillCircle(DOOR_W - 18, doorTop + doorH / 2, 3);
  g.fillStyle(0x6a3e1c);
  g.fillCircle(DOOR_W - 18, doorTop + doorH / 2, 1);
}

const BOARD_W = 96;
const BOARD_H = 80;

function drawQuestBoard(g: Phaser.GameObjects.Graphics): void {
  // Two wooden posts
  g.fillStyle(0x4a2e14);
  g.fillRect(8, 8, 4, BOARD_H - 8);
  g.fillRect(BOARD_W - 12, 8, 4, BOARD_H - 8);
  g.fillStyle(0x3c2410);
  g.fillRect(8, 8, 4, 2);
  g.fillRect(BOARD_W - 12, 8, 4, 2);
  // Board planks
  g.fillStyle(0x6a4a28);
  g.fillRect(6, 12, BOARD_W - 12, BOARD_H - 32);
  // Wood-grain horizontal lines
  g.fillStyle(0x4a3018);
  for (let y = 16; y < BOARD_H - 20; y += 6) {
    g.fillRect(6, y, BOARD_W - 12, 1);
  }
  // Border iron strap
  g.fillStyle(0x2a2a2e);
  g.fillRect(6, 12, BOARD_W - 12, 2);
  g.fillRect(6, BOARD_H - 22, BOARD_W - 12, 2);
  // Parchment pinned to board
  g.fillStyle(0xe8d9a6);
  g.fillRect(16, 18, BOARD_W - 32, BOARD_H - 44);
  g.fillStyle(0xc9b378);
  g.fillRect(16, 18, BOARD_W - 32, 2);
  g.fillRect(16, BOARD_H - 28, BOARD_W - 32, 2);
  // Faux quest lines on parchment
  g.fillStyle(0x5a3a1c);
  for (let y = 22; y < BOARD_H - 34; y += 4) {
    g.fillRect(20, y, BOARD_W - 40 - (y % 7 === 0 ? 6 : 0), 1);
  }
  // Nails
  g.fillStyle(0x6a6a72);
  g.fillRect(16, 19, 2, 2);
  g.fillRect(BOARD_W - 18, 19, 2, 2);
  g.fillRect(16, BOARD_H - 30, 2, 2);
  g.fillRect(BOARD_W - 18, BOARD_H - 30, 2, 2);
}

const BANNER_W = 80;
const BANNER_H = 100;

function drawRecruitBanner(g: Phaser.GameObjects.Graphics): void {
  // Horizontal pole
  g.fillStyle(0x5a3818);
  g.fillRect(4, 8, BANNER_W - 8, 4);
  // Pole caps
  g.fillStyle(0x6a4a20);
  g.fillCircle(6, 10, 3);
  g.fillCircle(BANNER_W - 6, 10, 3);
  // Hanging ropes
  g.fillStyle(0x3a2a14);
  g.fillRect(14, 12, 1, 4);
  g.fillRect(BANNER_W - 14, 12, 1, 4);
  // Banner cloth (deep red with gold trim)
  g.fillStyle(0x8a1818);
  g.fillRect(10, 16, BANNER_W - 20, BANNER_H - 30);
  // V-shaped bottom
  g.fillTriangle(10, BANNER_H - 14, BANNER_W / 2, BANNER_H - 14, BANNER_W / 2, BANNER_H - 4);
  g.fillTriangle(BANNER_W / 2, BANNER_H - 14, BANNER_W - 10, BANNER_H - 14, BANNER_W / 2, BANNER_H - 4);
  // Gold trim
  g.fillStyle(0xd4a83a);
  g.fillRect(10, 16, BANNER_W - 20, 2);
  g.fillRect(10, BANNER_H - 16, BANNER_W - 20, 2);
  g.fillRect(10, 16, 2, BANNER_H - 30);
  g.fillRect(BANNER_W - 12, 16, 2, BANNER_H - 30);
  // Crest in middle: crossed swords
  const cx = BANNER_W / 2;
  const cy = (16 + BANNER_H - 14) / 2;
  g.fillStyle(0xd4a83a);
  // Sword 1 (diagonal /)
  g.fillRect(cx - 14, cy + 8, 28, 2);
  // Actually we want crossed — simpler X via triangles
  g.fillTriangle(cx - 12, cy - 12, cx - 10, cy - 14, cx + 12, cy + 12);
  g.fillTriangle(cx + 12, cy - 12, cx + 10, cy - 14, cx - 12, cy + 12);
  g.fillStyle(0xfae888);
  g.fillCircle(cx, cy, 3); // boss/pommel
}

// Building facade — drawn behind each door. Wall extends from roof down to
// floor with a door-shaped opening cut into the lower-center, so the door
// sprite (64×96) sits INSIDE the doorway with wall framing it on three sides.
const FACADE_W = 110;
const FACADE_H = 240;
// Door opening cut into the facade — matches the door sprite display size so
// the door slots in neatly. Centered horizontally, flush with facade bottom.
const FACADE_DOOR_W = 64;
const FACADE_DOOR_H = 96;
const FACADE_DOOR_X = (FACADE_W - FACADE_DOOR_W) / 2; // left edge of opening
const FACADE_DOOR_Y = FACADE_H - FACADE_DOOR_H; // top edge of opening

interface FacadeSpec {
  wall: number;
  wallDark: number;
  roof: number;
  roofDark: number;
  window: number;
  trim?: number;
}

const FACADES: Record<string, FacadeSpec> = {
  'town-facade-war-room': { wall: 0x807068, wallDark: 0x504640, roof: 0x4a1818, roofDark: 0x2a0808, window: 0x202a30 },
  'town-facade-oracle': { wall: 0xb8a8d0, wallDark: 0x806890, roof: 0x4030a0, roofDark: 0x281858, window: 0x0a1a3a, trim: 0xd4a83a },
  'town-facade-library': { wall: 0x6a5a3a, wallDark: 0x4a3e22, roof: 0x3a2812, roofDark: 0x1f1408, window: 0x1a2a48 },
  'town-facade-tavern': { wall: 0xa07840, wallDark: 0x704820, roof: 0x5a2818, roofDark: 0x3a1408, window: 0xfaa030, trim: 0x5a3818 },
  'town-facade-armory': { wall: 0x707880, wallDark: 0x484e58, roof: 0x383030, roofDark: 0x1f1818, window: 0x18181c, trim: 0x9a9a9a },
  'town-facade-guild-hall': { wall: 0x807068, wallDark: 0x504a40, roof: 0x6a3a14, roofDark: 0x3a1f08, window: 0x281a48, trim: 0xd4a83a },
  'town-facade-hall-of-returns': { wall: 0x4a4858, wallDark: 0x2a2a3a, roof: 0x181828, roofDark: 0x080814, window: 0x0a0e1a, trim: 0x9a8aa8 },
};

function drawFacade(g: Phaser.GameObjects.Graphics, spec: FacadeSpec): void {
  // Wall body — extends from below the roof all the way to the floor
  g.fillStyle(spec.wall);
  g.fillRect(0, 30, FACADE_W, FACADE_H - 30);
  // Wall stone texture (subtle vertical lines)
  g.fillStyle(spec.wallDark);
  for (let x = 8; x < FACADE_W; x += 18) {
    g.fillRect(x, 32, 1, FACADE_H - 34);
  }
  // Foundation course (bottom band of darker stone) — drawn before doorway
  // so the doorway cutout punches through it cleanly
  g.fillStyle(spec.wallDark);
  g.fillRect(0, FACADE_H - 8, FACADE_W, 8);
  // Pitched roof
  g.fillStyle(spec.roof);
  g.fillTriangle(-4, 32, FACADE_W + 4, 32, FACADE_W / 2, 0);
  g.fillStyle(spec.roofDark);
  g.fillTriangle(-4, 32, FACADE_W + 4, 32, FACADE_W / 2, 4);
  g.fillStyle(spec.roof);
  g.fillTriangle(-4, 32, FACADE_W + 4, 32, FACADE_W / 2, 0);
  // Roof shadow line under eave
  g.fillStyle(0x1a0a04);
  g.fillRect(0, 30, FACADE_W, 2);
  // Windows — sit in the upper portion of the wall, well above the doorway
  g.fillStyle(spec.window);
  g.fillRect(14, 50, 18, 22);
  g.fillRect(FACADE_W - 32, 50, 18, 22);
  g.fillStyle(spec.wallDark);
  g.fillRect(22, 50, 2, 22);
  g.fillRect(14, 60, 18, 2);
  g.fillRect(FACADE_W - 32, 60, 18, 2);
  g.fillRect(FACADE_W - 24, 50, 2, 22);
  // Optional trim accent (banner, crest, dome, etc.) — sits between windows
  if (spec.trim !== undefined) {
    g.fillStyle(spec.trim);
    g.fillRect(FACADE_W / 2 - 4, 50, 8, 22);
  }
  // ---- Doorway opening ---------------------------------------------------
  // Cut a door-shaped recess into the lower-center of the wall. The actual
  // door sprite is drawn on top of this in base-town-scene; the dark fill
  // here means any gap between sprite edge and opening reads as shadow.
  const dx = FACADE_DOOR_X;
  const dy = FACADE_DOOR_Y;
  const dw = FACADE_DOOR_W;
  const dh = FACADE_DOOR_H;
  // Deep shadow inside the opening
  g.fillStyle(0x100a06);
  g.fillRect(dx, dy, dw, dh);
  // Stone door-frame: a slightly lighter ring of stones around the opening
  // (left jamb, right jamb, lintel above). Two-pixel highlight + one-pixel
  // dark shadow gives the recess depth.
  g.fillStyle(spec.wall);
  // Lintel above the opening
  g.fillRect(dx - 4, dy - 4, dw + 8, 4);
  // Left jamb extension (sits flush with wall but framed)
  g.fillRect(dx - 4, dy, 4, dh);
  // Right jamb extension
  g.fillRect(dx + dw, dy, 4, dh);
  // Dark shadow line on inside edges of the frame (sells the "set into wall")
  g.fillStyle(spec.wallDark);
  g.fillRect(dx, dy, dw, 2); // shadow under lintel
  g.fillRect(dx, dy, 2, dh); // shadow on left inside jamb
  g.fillRect(dx + dw - 2, dy, 2, dh); // shadow on right inside jamb
  // Highlight band on the outside of the frame to catch the eye
  g.fillStyle(0x000000);
  g.fillRect(dx - 5, dy - 5, dw + 10, 1); // top edge of lintel
  g.fillRect(dx - 5, dy - 4, 1, dh + 4); // left edge of jamb
  g.fillRect(dx + dw + 4, dy - 4, 1, dh + 4); // right edge of jamb
}

/**
 * Call once from BootScene.create() (or any scene that boots first). Generates
 * adventurer + monster textures and registers them under the project's
 * existing ASSET_KEYS so all consumers pick up the new look automatically.
 */
export function generateAllProceduralSprites(scene: Phaser.Scene): void {
  // Adventurer — idle (no offsets), walk-a, walk-b, attack
  generateTexture(scene, 'character/adventurer-idle', PLAYER_W, PLAYER_H, (g) =>
    drawAdventurer(g, ADVENTURER_PALETTE, 'idle'),
  );
  generateTexture(scene, 'character/adventurer-walk', PLAYER_W, PLAYER_H, (g) =>
    drawAdventurer(g, ADVENTURER_PALETTE, 'walk-a'),
  );
  generateTexture(scene, 'character/adventurer-attack', PLAYER_W, PLAYER_H, (g) =>
    drawAdventurer(g, ADVENTURER_PALETTE, 'attack'),
  );
  // NPC villager: same body, different palette
  generateTexture(scene, 'character/npc-villager', PLAYER_W, PLAYER_H, (g) =>
    drawAdventurer(g, { ...ADVENTURER_PALETTE, tunic: 0x804820, tunicDark: 0x4a2812, hair: 0x301810 }, 'idle'),
  );

  // Monsters
  for (const [key, spec] of Object.entries(MONSTERS)) {
    generateTexture(scene, key, MONSTER_W, MONSTER_H, (g) => drawMonster(g, spec));
  }

  // Decor textures used by scenes (doors, quest board, recruit banner, facades)
  generateTexture(scene, 'tex-door', DOOR_W, DOOR_H, drawDoor);
  generateTexture(scene, 'tex-quest-board', BOARD_W, BOARD_H, drawQuestBoard);
  generateTexture(scene, 'tex-recruit-banner', BANNER_W, BANNER_H, drawRecruitBanner);
  for (const [key, spec] of Object.entries(FACADES)) {
    generateTexture(scene, key, FACADE_W, FACADE_H, (g) => drawFacade(g, spec));
  }
}

export const PROCEDURAL_TEXTURE_KEYS = {
  door: 'tex-door',
  questBoard: 'tex-quest-board',
  recruitBanner: 'tex-recruit-banner',
  facadeFor: (sceneKey: string): string => `town-facade-${sceneKey}`,
};
