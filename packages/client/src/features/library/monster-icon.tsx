import { useEffect, useRef } from 'react';

// Canvas-rendered monster icons. Mirrors the procedural sprites the Phaser
// boot scene draws into texture keys (see game/procedural-sprites.ts), but
// runs in the DOM so the React Library / Bestiary can render them as proper
// images without depending on the broken PNG stubs in /assets/monsters/.

interface MonsterSpec {
  body: string;
  bodyDark: string;
  accent: string;
  eyes: string;
  outline: string;
  shape:
    | 'goblin'
    | 'imp'
    | 'wraith'
    | 'ogre'
    | 'hydra'
    | 'mimic'
    | 'wizard'
    | 'troll'
    | 'lich'
    | 'dragon';
}

// Hex (0xRRGGBB) numbers from procedural-sprites converted to CSS strings.
const toCss = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

const MONSTERS: Record<string, MonsterSpec> = {
  goblin_linter: {
    body: toCss(0x5a8a3a), bodyDark: toCss(0x3a5e1f), accent: toCss(0x882020),
    eyes: toCss(0xffeb3b), outline: toCss(0x1a2010), shape: 'goblin',
  },
  imp_typecheck: {
    body: toCss(0xb22050), bodyDark: toCss(0x6c0e2e), accent: toCss(0xff8c00),
    eyes: toCss(0xfffacd), outline: toCss(0x180810), shape: 'imp',
  },
  wraith_flaky_test: {
    body: toCss(0x8a8aa8), bodyDark: toCss(0x40406a), accent: toCss(0xc4c8e8),
    eyes: toCss(0x00ffff), outline: toCss(0x1a1830), shape: 'wraith',
  },
  ogre_failing_test: {
    body: toCss(0x6a5028), bodyDark: toCss(0x3c2c14), accent: toCss(0x90703a),
    eyes: toCss(0xaa3030), outline: toCss(0x1a1408), shape: 'ogre',
  },
  hydra_ac_mismatch: {
    body: toCss(0x2a8a4a), bodyDark: toCss(0x143c20), accent: toCss(0xc0d030),
    eyes: toCss(0xffeb3b), outline: toCss(0x080f0a), shape: 'hydra',
  },
  mimic_silent_failure: {
    body: toCss(0x6a3a14), bodyDark: toCss(0x3c1f08), accent: toCss(0xff6020),
    eyes: toCss(0xffeb3b), outline: toCss(0x180a04), shape: 'mimic',
  },
  wizard_env_or_dep: {
    body: toCss(0x4a3aaa), bodyDark: toCss(0x281858), accent: toCss(0xfacd2a),
    eyes: toCss(0xa0c8ff), outline: toCss(0x0e0a30), shape: 'wizard',
  },
  troll_build_fail: {
    body: toCss(0x4a6a2a), bodyDark: toCss(0x223a12), accent: toCss(0xa07050),
    eyes: toCss(0xff5050), outline: toCss(0x081a08), shape: 'troll',
  },
  lich_repeated_failure: {
    body: toCss(0x303040), bodyDark: toCss(0x101018), accent: toCss(0x9000c0),
    eyes: toCss(0x40e0ff), outline: toCss(0x040408), shape: 'lich',
  },
  dragon_epic_obstacle: {
    body: toCss(0xa02828), bodyDark: toCss(0x500e0e), accent: toCss(0xfaa030),
    eyes: toCss(0xffff60), outline: toCss(0x180404), shape: 'dragon',
  },
};

// Shape helpers — equivalent to the Phaser Graphics calls in procedural-sprites.
function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function circle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}
function triangle(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fill();
}

// Each draw is on a 32x32 unit canvas; the icon component scales via CSS.
function drawMonster(ctx: CanvasRenderingContext2D, spec: MonsterSpec): void {
  ctx.clearRect(0, 0, 32, 32);
  const cx = 16;
  ctx.fillStyle = spec.body;
  switch (spec.shape) {
    case 'goblin':
      rect(ctx, cx - 6, 14, 12, 12, spec.body);
      circle(ctx, cx, 10, 6, spec.body);
      triangle(ctx, cx - 7, 8, cx - 4, 4, cx - 3, 10, spec.body);
      triangle(ctx, cx + 7, 8, cx + 4, 4, cx + 3, 10, spec.body);
      rect(ctx, cx - 5, 25, 3, 5, spec.body);
      rect(ctx, cx + 2, 25, 3, 5, spec.body);
      break;
    case 'imp':
      circle(ctx, cx, 14, 8, spec.body);
      triangle(ctx, cx - 8, 8, cx - 3, 4, cx - 2, 10, spec.body);
      triangle(ctx, cx + 8, 8, cx + 3, 4, cx + 2, 10, spec.body);
      triangle(ctx, cx - 11, 18, cx - 4, 20, cx - 7, 14, spec.body);
      triangle(ctx, cx + 11, 18, cx + 4, 20, cx + 7, 14, spec.body);
      break;
    case 'wraith':
      rect(ctx, cx - 8, 8, 16, 22, spec.body);
      circle(ctx, cx, 10, 7, spec.body);
      triangle(ctx, cx - 8, 30, cx, 26, cx - 4, 30, spec.bodyDark);
      triangle(ctx, cx, 30, cx + 8, 26, cx + 4, 30, spec.bodyDark);
      break;
    case 'ogre':
      rect(ctx, cx - 8, 10, 16, 18, spec.body);
      circle(ctx, cx, 8, 5, spec.body);
      rect(ctx, cx - 6, 28, 4, 4, spec.body);
      rect(ctx, cx + 2, 28, 4, 4, spec.body);
      rect(ctx, cx - 2, 9, 1, 2, '#fff8d8');
      rect(ctx, cx + 1, 9, 1, 2, '#fff8d8');
      break;
    case 'hydra':
      rect(ctx, cx - 6, 18, 12, 10, spec.body);
      rect(ctx, cx - 4, 8, 2, 12, spec.body);
      circle(ctx, cx - 3, 8, 3, spec.body);
      rect(ctx, cx + 2, 8, 2, 12, spec.body);
      circle(ctx, cx + 3, 8, 3, spec.body);
      rect(ctx, cx - 1, 6, 2, 14, spec.body);
      circle(ctx, cx, 6, 3, spec.body);
      break;
    case 'mimic':
      rect(ctx, cx - 8, 12, 16, 16, spec.body);
      rect(ctx, cx - 8, 12, 16, 4, spec.bodyDark);
      rect(ctx, cx - 8, 24, 16, 4, spec.bodyDark);
      rect(ctx, cx - 2, 14, 4, 4, spec.accent);
      for (let i = -7; i <= 6; i += 3) {
        triangle(ctx, cx + i, 16, cx + i + 2, 16, cx + i + 1, 19, '#fff8d8');
      }
      break;
    case 'wizard':
      rect(ctx, cx - 6, 16, 12, 14, spec.body);
      circle(ctx, cx, 12, 4, spec.body);
      triangle(ctx, cx - 6, 10, cx + 6, 10, cx, 2, spec.body);
      circle(ctx, cx, 4, 1, spec.accent);
      break;
    case 'troll':
      rect(ctx, cx - 8, 12, 16, 16, spec.body);
      circle(ctx, cx, 10, 5, spec.body);
      triangle(ctx, cx - 4, 6, cx - 2, 1, cx, 6, spec.body);
      rect(ctx, cx - 5, 28, 3, 4, spec.body);
      rect(ctx, cx + 2, 28, 3, 4, spec.body);
      break;
    case 'lich':
      rect(ctx, cx - 7, 16, 14, 14, spec.body);
      circle(ctx, cx, 11, 4, '#e8e8e8');
      rect(ctx, cx - 2, 11, 1, 1, spec.outline);
      rect(ctx, cx + 1, 11, 1, 1, spec.outline);
      circle(ctx, cx, 22, 2, spec.accent);
      break;
    case 'dragon':
      rect(ctx, cx - 6, 14, 12, 14, spec.body);
      circle(ctx, cx, 14, 5, spec.body);
      triangle(ctx, cx - 12, 14, cx - 4, 12, cx - 6, 22, spec.body);
      triangle(ctx, cx + 12, 14, cx + 4, 12, cx + 6, 22, spec.body);
      triangle(ctx, cx + 2, 8, cx + 6, 4, cx + 4, 10, spec.accent);
      break;
  }
  // Eyes — overlaid after body
  if (spec.shape === 'hydra') {
    rect(ctx, cx - 4, 8, 1, 1, spec.eyes);
    rect(ctx, cx + 3, 8, 1, 1, spec.eyes);
    rect(ctx, cx, 6, 1, 1, spec.eyes);
  } else if (spec.shape === 'imp') {
    rect(ctx, cx - 3, 13, 1, 1, spec.eyes);
    rect(ctx, cx + 2, 13, 1, 1, spec.eyes);
  } else if (spec.shape === 'lich') {
    rect(ctx, cx - 2, 11, 1, 1, spec.eyes);
    rect(ctx, cx + 1, 11, 1, 1, spec.eyes);
  } else if (spec.shape !== 'wraith' && spec.shape !== 'mimic') {
    rect(ctx, cx - 2, 9, 1, 1, spec.eyes);
    rect(ctx, cx + 1, 9, 1, 1, spec.eyes);
  }
}

interface MonsterIconProps {
  monsterTypeId: string;
  size?: number;
  alt?: string;
  className?: string;
  background?: string;
}

const FALLBACK_TYPE_ID = 'goblin_linter';

export function MonsterIcon({
  monsterTypeId,
  size = 32,
  alt,
  className,
  background,
}: MonsterIconProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spec = MONSTERS[monsterTypeId] ?? MONSTERS[FALLBACK_TYPE_ID];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !spec) return;
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    drawMonster(ctx, spec);
  }, [spec]);

  return (
    <canvas
      ref={canvasRef}
      width={32}
      height={32}
      role="img"
      aria-label={alt ?? `Monster: ${monsterTypeId}`}
      className={className}
      style={{
        width: size,
        height: size,
        imageRendering: 'pixelated',
        background: background ?? 'transparent',
        borderRadius: 2,
      }}
    />
  );
}

export const KNOWN_MONSTER_TYPE_IDS = Object.keys(MONSTERS);
