import { useEffect, useRef, useState } from 'react';
import {
  TUNIC_COLORS,
  HAIR_COLORS,
  SKIN_TONES,
  HAIR_STYLES,
  type AdventurerStyle,
  type TunicColor,
  type HairColor,
  type SkinTone,
  type HairStyle,
} from '@code-quests/shared';
import { paletteForStyle, type PaletteSpec } from '../game/procedural-sprites';
import { usePlayerStyleStore } from '../stores/player-style-store';

// Embedded in the Help panel — lets the user style their own avatar.
// Persists to localStorage via usePlayerStyleStore. The Phaser BaseTownScene
// regenerates the player's textures from the current style on every scene
// mount, so the change shows on the next door click / route nav.

const TUNIC_LABEL: Record<TunicColor, string> = {
  green: 'Forest Green',
  blue: 'Sapphire Blue',
  red: 'Crimson Red',
  gold: 'Royal Gold',
  purple: 'Amethyst Purple',
  brown: 'Earth Brown',
};

const HAIR_LABEL: Record<HairColor, string> = {
  brown: 'Brown',
  blonde: 'Blonde',
  black: 'Black',
  red: 'Red',
  silver: 'Silver',
};

const PREVIEW_SCALE = 4;
const SWATCH_TUNIC: Record<TunicColor, string> = {
  green: '#3d6e3a',
  blue: '#2a4a8a',
  red: '#8a2020',
  gold: '#c4a020',
  purple: '#5a2a8a',
  brown: '#5a3a18',
};
const SWATCH_HAIR: Record<HairColor, string> = {
  brown: '#7a4a18',
  blonde: '#d8b878',
  black: '#1a0e08',
  red: '#a04020',
  silver: '#b0b0c4',
};

const SWATCH_SKIN: Record<SkinTone, string> = {
  fair: '#f4d0a4',
  olive: '#d8b078',
  tan: '#c89060',
  brown: '#9c6838',
  dark: '#603a1c',
};

const HAIR_STYLE_LABEL: Record<HairStyle, string> = {
  short: 'Short',
  long: 'Long',
  shaved: 'Shaved',
  bun: 'Bun',
  ponytail: 'Ponytail',
};

const SKIN_LABEL: Record<SkinTone, string> = {
  fair: 'Fair',
  olive: 'Olive',
  tan: 'Tan',
  brown: 'Brown',
  dark: 'Dark',
};

function drawPreview(canvas: HTMLCanvasElement, palette: PaletteSpec): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const scale = PREVIEW_SCALE;
  const px = (n: number) => n * scale;
  const fillRect = (x: number, y: number, w: number, h: number, color: number) => {
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.fillRect(px(x), px(y), px(w), px(h));
  };
  const fillCircle = (cx: number, cy: number, r: number, color: number) => {
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.beginPath();
    ctx.arc(px(cx), px(cy), px(r), 0, Math.PI * 2);
    ctx.fill();
  };
  const headCx = 16;
  const headCy = 12;
  const headR = 6;
  // Face first
  fillCircle(headCx, headCy, headR, palette.skin);
  // Hair shape per hairStyle
  if (palette.hairStyle !== 'shaved') {
    fillRect(headCx - 6, headCy - 6, 12, 4, palette.hair);
    fillRect(headCx - 7, headCy - 5, 2, 3, palette.hair);
    fillRect(headCx + 5, headCy - 5, 2, 3, palette.hair);
    if (palette.hairStyle === 'long') {
      fillRect(headCx - 8, headCy - 2, 2, 12, palette.hair);
      fillRect(headCx + 6, headCy - 2, 2, 12, palette.hair);
    } else if (palette.hairStyle === 'bun') {
      fillCircle(headCx, headCy - 8, 3, palette.hair);
    } else if (palette.hairStyle === 'ponytail') {
      fillRect(headCx + 6, headCy - 2, 2, 10, palette.hair);
      fillRect(headCx + 7, headCy + 4, 2, 3, palette.hair);
    }
  }
  // Face shading and eyes on top
  fillRect(headCx + 3, headCy - 1, 1, 1, palette.skinDark);
  fillRect(headCx - 2, headCy - 1, 1, 1, palette.outline);
  fillRect(headCx + 2, headCy - 1, 1, 1, palette.outline);
  const bodyY = 19;
  const bodyH = 16;
  fillRect(headCx - 6, bodyY, 12, bodyH, palette.tunic);
  fillRect(headCx - 6, bodyY + bodyH - 3, 12, 3, palette.tunicDark);
  fillRect(headCx - 7, bodyY + bodyH - 2, 14, 2, palette.belt);
  const armY = bodyY + 1;
  fillRect(headCx - 8, armY, 2, 9, palette.tunic);
  fillRect(headCx + 6, armY, 2, 9, palette.tunic);
  fillRect(headCx - 8, armY + 9, 2, 2, palette.skin);
  fillRect(headCx + 6, armY + 9, 2, 2, palette.skin);
  const legY = bodyY + bodyH;
  fillRect(headCx - 5, legY, 4, 9, palette.boots);
  fillRect(headCx + 1, legY, 4, 9, palette.boots);
  fillRect(headCx - 5, legY + 7, 4, 2, palette.bootsDark);
  fillRect(headCx + 1, legY + 7, 4, 2, palette.bootsDark);
}

export function PlayerWardrobeSection() {
  const style = usePlayerStyleStore((s) => s.style);
  const setStyle = usePlayerStyleStore((s) => s.setStyle);
  const [tunic, setTunic] = useState<TunicColor | undefined>(style.tunic);
  const [hair, setHair] = useState<HairColor | undefined>(style.hair);
  const [skin, setSkin] = useState<SkinTone | undefined>(style.skin);
  const [hairStyle, setHairStyle] = useState<HairStyle | undefined>(style.hairStyle);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [saved, setSaved] = useState(false);

  const currentStyle: AdventurerStyle = {
    ...(tunic !== undefined && { tunic }),
    ...(hair !== undefined && { hair }),
    ...(skin !== undefined && { skin }),
    ...(hairStyle !== undefined && { hairStyle }),
  };

  useEffect(() => {
    if (canvasRef.current) {
      drawPreview(canvasRef.current, paletteForStyle(currentStyle));
    }
  }, [tunic, hair, skin, hairStyle]);

  const onSave = () => {
    setStyle(currentStyle);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        padding: 12,
        background: '#f5ecd6',
        border: '1px solid #b5a07a',
        borderRadius: 6,
      }}
    >
      <canvas
        ref={canvasRef}
        width={32 * PREVIEW_SCALE}
        height={48 * PREVIEW_SCALE}
        aria-label="Your avatar preview"
        style={{
          width: 96,
          height: 144,
          imageRendering: 'pixelated',
          background: '#1a0e08',
          borderRadius: 4,
        }}
      />
      <div style={{ flex: 1 }}>
        <p style={{ margin: '0 0 6px', fontSize: '0.85rem', color: '#5a3818' }}>
          Tunic
        </p>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
          {TUNIC_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setTunic(c)}
              aria-label={TUNIC_LABEL[c]}
              aria-pressed={tunic === c}
              title={TUNIC_LABEL[c]}
              style={{
                width: 26,
                height: 26,
                borderRadius: 4,
                background: SWATCH_TUNIC[c],
                border: tunic === c ? '2px solid #7a1818' : '2px solid #b5a07a',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          ))}
        </div>
        <p style={{ margin: '0 0 6px', fontSize: '0.85rem', color: '#5a3818' }}>
          Skin
        </p>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
          {SKIN_TONES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setSkin(c)}
              aria-label={SKIN_LABEL[c]}
              aria-pressed={skin === c}
              title={SKIN_LABEL[c]}
              style={{
                width: 26,
                height: 26,
                borderRadius: 4,
                background: SWATCH_SKIN[c],
                border: skin === c ? '2px solid #7a1818' : '2px solid #b5a07a',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          ))}
        </div>
        <p style={{ margin: '0 0 6px', fontSize: '0.85rem', color: '#5a3818' }}>
          Hair colour
        </p>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
          {HAIR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setHair(c)}
              aria-label={HAIR_LABEL[c]}
              aria-pressed={hair === c}
              title={HAIR_LABEL[c]}
              style={{
                width: 26,
                height: 26,
                borderRadius: 4,
                background: SWATCH_HAIR[c],
                border: hair === c ? '2px solid #7a1818' : '2px solid #b5a07a',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          ))}
        </div>
        <p style={{ margin: '0 0 6px', fontSize: '0.85rem', color: '#5a3818' }}>
          Hair style
        </p>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
          {HAIR_STYLES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setHairStyle(s)}
              aria-pressed={hairStyle === s}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                background: hairStyle === s ? '#7a1818' : '#fef9e7',
                color: hairStyle === s ? '#fef9e7' : '#3a1a08',
                border: '1px solid #b5a07a',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              {HAIR_STYLE_LABEL[s]}
            </button>
          ))}
        </div>
        <p style={{ margin: '8px 0 6px', fontSize: '0.78rem', color: '#7a4a18', fontStyle: 'italic' }}>
          Pick your look, then click <strong>Save my look</strong> to keep it.
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={onSave}
          aria-live="polite"
        >
          {saved ? 'Saved — refresh to see' : 'Save my look'}
        </button>
      </div>
    </div>
  );
}
