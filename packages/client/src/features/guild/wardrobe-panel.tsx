import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TUNIC_COLORS,
  HAIR_COLORS,
  type Adventurer,
  type AdventurerStyle,
  type TunicColor,
  type HairColor,
} from '@code-quests/shared';
import { api, ApiError } from '../../lib/api';
import { paletteForStyle, type PaletteSpec } from '../../game/procedural-sprites';

// Display labels — values match the schema enums verbatim.
const TUNIC_OPTIONS: { value: TunicColor; label: string }[] = [
  { value: 'green', label: 'Forest Green' },
  { value: 'blue', label: 'Sapphire Blue' },
  { value: 'red', label: 'Crimson Red' },
  { value: 'gold', label: 'Royal Gold' },
  { value: 'purple', label: 'Amethyst Purple' },
  { value: 'brown', label: 'Earth Brown' },
];

const HAIR_OPTIONS: { value: HairColor; label: string }[] = [
  { value: 'brown', label: 'Brown' },
  { value: 'blonde', label: 'Blonde' },
  { value: 'black', label: 'Black' },
  { value: 'red', label: 'Red' },
  { value: 'silver', label: 'Silver' },
];

// Sanity guard — the option lists above must stay in sync with the schema enums.
// If a new color is added to TUNIC_COLORS without a matching label, this throws
// during development. Cheap insurance against the option/enum drift bug.
if (TUNIC_OPTIONS.length !== TUNIC_COLORS.length) {
  throw new Error('TUNIC_OPTIONS out of sync with shared TUNIC_COLORS');
}
if (HAIR_OPTIONS.length !== HAIR_COLORS.length) {
  throw new Error('HAIR_OPTIONS out of sync with shared HAIR_COLORS');
}

const PREVIEW_SCALE = 4; // 32x48 sprite → 128x192 preview canvas

interface WardrobePanelProps {
  adventurer: Adventurer;
  onClose: () => void;
}

// Render an idle-pose adventurer into a 2D canvas using the same palette
// math the Phaser scene uses. We don't import drawAdventurer directly because
// it draws into a Phaser.Graphics; instead we mirror its key shapes with
// canvas fillRect/fillCircle calls so what the user sees in the preview
// matches what they'll see in the Guild Hall.
function drawPreview(canvas: HTMLCanvasElement, palette: PaletteSpec): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const scale = PREVIEW_SCALE;
  const px = (n: number) => n * scale;
  const fillRect = (x: number, y: number, dw: number, dh: number, color: number) => {
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.fillRect(px(x), px(y), px(dw), px(dh));
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

  // Hair cap
  fillRect(headCx - 6, headCy - 6, 12, 4, palette.hair);
  fillRect(headCx - 7, headCy - 5, 2, 3, palette.hair);
  fillRect(headCx + 5, headCy - 5, 2, 3, palette.hair);
  // Face
  fillCircle(headCx, headCy, headR, palette.skin);
  fillRect(headCx + 3, headCy - 1, 1, 1, palette.skinDark);
  fillRect(headCx - 2, headCy - 1, 1, 1, palette.outline);
  fillRect(headCx + 2, headCy - 1, 1, 1, palette.outline);
  // Body / tunic
  const bodyY = 19;
  const bodyH = 16;
  fillRect(headCx - 6, bodyY, 12, bodyH, palette.tunic);
  fillRect(headCx - 6, bodyY + bodyH - 3, 12, 3, palette.tunicDark);
  fillRect(headCx - 7, bodyY + bodyH - 2, 14, 2, palette.belt);
  // Arms hanging
  const armY = bodyY + 1;
  fillRect(headCx - 8, armY, 2, 9, palette.tunic);
  fillRect(headCx + 6, armY, 2, 9, palette.tunic);
  fillRect(headCx - 8, armY + 9, 2, 2, palette.skin);
  fillRect(headCx + 6, armY + 9, 2, 2, palette.skin);
  // Legs
  const legY = bodyY + bodyH;
  fillRect(headCx - 5, legY, 4, 9, palette.boots);
  fillRect(headCx + 1, legY, 4, 9, palette.boots);
  fillRect(headCx - 5, legY + 7, 4, 2, palette.bootsDark);
  fillRect(headCx + 1, legY + 7, 4, 2, palette.bootsDark);
}

export default function WardrobePanel({ adventurer, onClose }: WardrobePanelProps) {
  const initialStyle: AdventurerStyle = adventurer.style ?? {};
  const [tunic, setTunic] = useState<TunicColor | undefined>(initialStyle.tunic);
  const [hair, setHair] = useState<HairColor | undefined>(initialStyle.hair);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const queryClient = useQueryClient();

  const currentStyle: AdventurerStyle = { ...(tunic && { tunic }), ...(hair && { hair }) };

  useEffect(() => {
    if (canvasRef.current) {
      drawPreview(canvasRef.current, paletteForStyle(currentStyle));
    }
  }, [currentStyle.tunic, currentStyle.hair]);

  const mutation = useMutation({
    mutationFn: (style: AdventurerStyle) => api.adventurers.updateStyle(adventurer.id, style),
    onSuccess: (updated) => {
      queryClient.setQueryData<Adventurer[]>(['adventurers'], (old) =>
        (old ?? []).map((a) => (a.id === updated.id ? updated : a)),
      );
    },
  });

  const isSaving = mutation.isPending;
  const isSuccess = mutation.isSuccess;
  const serverError = mutation.error
    ? mutation.error instanceof ApiError
      ? mutation.error.message
      : (mutation.error as Error).message || 'Failed to save style.'
    : null;

  function handleSave() {
    mutation.mutate(currentStyle);
  }

  // Auto-close shortly after a successful save so the modal flow feels snappy.
  useEffect(() => {
    if (!isSuccess) return;
    const t = setTimeout(() => onClose(), 1500);
    return () => clearTimeout(t);
  }, [isSuccess, onClose]);

  return (
    <div className="wardrobe-panel" role="region" aria-labelledby="wardrobe-title">
      <h3 id="wardrobe-title">Wardrobe — {adventurer.name}</h3>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {isSaving ? 'Saving…' : ''}
      </p>

      {isSuccess && (
        <p className="recruit-success" role="status" aria-live="polite">
          Style saved.
        </p>
      )}
      {serverError && !isSuccess && (
        <p className="recruit-error" role="alert" aria-live="assertive">
          {serverError}
        </p>
      )}

      <div className="wardrobe-preview">
        <canvas
          ref={canvasRef}
          width={32 * PREVIEW_SCALE}
          height={48 * PREVIEW_SCALE}
          aria-label={`Preview of ${adventurer.name} with ${tunic ?? 'default'} tunic and ${hair ?? 'default'} hair`}
        />
      </div>

      <fieldset className="form-fieldset">
        <legend>Tunic Color</legend>
        <div className="wardrobe-options" role="radiogroup" aria-label="Tunic color">
          {TUNIC_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={tunic === opt.value}
              className={tunic === opt.value ? 'wardrobe-option wardrobe-option--selected' : 'wardrobe-option'}
              onClick={() => setTunic(opt.value)}
              disabled={isSaving}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="form-fieldset">
        <legend>Hair Color</legend>
        <div className="wardrobe-options" role="radiogroup" aria-label="Hair color">
          {HAIR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={hair === opt.value}
              className={hair === opt.value ? 'wardrobe-option wardrobe-option--selected' : 'wardrobe-option'}
              onClick={() => setHair(opt.value)}
              disabled={isSaving}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="form-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={handleSave}
          disabled={isSaving}
          aria-busy={isSaving ? 'true' : undefined}
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={isSaving}>
          Close
        </button>
      </div>
    </div>
  );
}
