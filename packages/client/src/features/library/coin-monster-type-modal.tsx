import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useFocusTrap } from '../../lib/use-focus-trap';
import { MONSTER_SPRITE_OPTIONS } from '../../assets/monster-sprites-manifest';

type Props = {
  onClose: () => void;
  onSuccess: (typeName: string) => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
};

const SPRITE_COLS = 5;

export default function CoinMonsterTypeModal({ onClose, onSuccess, triggerRef }: Props) {
  const queryClient = useQueryClient();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const spriteBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [selectedSpriteIndex, setSelectedSpriteIndex] = useState(-1);
  const [spriteError, setSpriteError] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState(1);
  const [signature, setSignature] = useState('');
  const [signatureError, setSignatureError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current !== null) {
        clearTimeout(successTimerRef.current);
        successTimerRef.current = null;
      }
    };
  }, []);

  function handleClose() {
    triggerRef.current?.focus();
    onClose();
  }

  const panelRef = useFocusTrap(handleClose);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  function validateName(value: string): string | null {
    const trimmed = value.trim();
    if (trimmed.length === 0) return 'Name is required.';
    if (!/[A-Za-z0-9]/.test(trimmed)) return 'Name must include at least one letter or digit.';
    return null;
  }

  function validateSignature(value: string): string | null {
    if (value.trim().length === 0) return 'Failure signature is required.';
    try { new RegExp(value); } catch { return 'Must be a valid regular expression.'; }
    return null;
  }

  function handleNameBlur() {
    setNameError(validateName(name));
  }

  function handleSignatureChange(value: string) {
    setSignature(value);
    if (value.trim().length > 0) {
      setSignatureError(validateSignature(value));
    } else {
      setSignatureError(null);
    }
  }

  function handleSignatureBlur() {
    setSignatureError(validateSignature(signature));
  }

  function selectSprite(index: number) {
    setSelectedSpriteIndex(index);
    setSpriteError(null);
  }

  function handleSpriteKeyDown(e: React.KeyboardEvent) {
    const count = MONSTER_SPRITE_OPTIONS.length;
    const current = selectedSpriteIndex === -1 ? 0 : selectedSpriteIndex;
    let next = current;
    switch (e.key) {
      case 'ArrowRight': next = (current + 1) % count; break;
      case 'ArrowLeft': next = (current - 1 + count) % count; break;
      case 'ArrowDown': next = Math.min(current + SPRITE_COLS, count - 1); break;
      case 'ArrowUp': next = Math.max(current - SPRITE_COLS, 0); break;
      default: return;
    }
    e.preventDefault();
    setSelectedSpriteIndex(next);
    setSpriteError(null);
    spriteBtnRefs.current[next]?.focus();
  }

  const activeTabIndex = selectedSpriteIndex === -1 ? 0 : selectedSpriteIndex;

  const isSubmitDisabled =
    isSubmitting ||
    name.trim().length === 0 ||
    selectedSpriteIndex === -1 ||
    signature.trim().length === 0 ||
    signatureError !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nErr = validateName(name);
    const sErr = validateSignature(signature);
    const noSprite = selectedSpriteIndex === -1;
    if (nErr) setNameError(nErr);
    if (sErr) setSignatureError(sErr);
    if (noSprite) setSpriteError('Please select a sprite.');
    if (nErr || sErr || noSprite) return;

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const type = await api.monsters.createType({
        name: name.trim(),
        spritePath: MONSTER_SPRITE_OPTIONS[selectedSpriteIndex].path,
        defaultDifficulty: difficulty,
        failureSignature: signature.trim(),
      });
      void queryClient.invalidateQueries({ queryKey: ['monster-types'] });
      void queryClient.invalidateQueries({ queryKey: ['monsters'] });
      setSuccessMsg(
        `Type '${type.name}' coined — keep watch on your next quest (id: ${type.id})`,
      );
      successTimerRef.current = setTimeout(() => {
        onSuccess(type.name);
        handleClose();
      }, 3000);
    } catch (err: unknown) {
      setIsSubmitting(false);
      const is409 =
        err !== null &&
        typeof err === 'object' &&
        'status' in err &&
        (err as { status?: number }).status === 409;
      const isNameField =
        err !== null &&
        typeof err === 'object' &&
        'field' in err &&
        (err as { field?: string }).field === 'name';
      if (is409 || isNameField) {
        setNameError(
          (err as { message?: string }).message ?? 'A type with this name already exists.',
        );
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to coin type.';
        setSubmitError(msg);
      }
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coin-type-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div ref={panelRef} className="modal-panel coin-type-modal">
        <h3 id="coin-type-modal-title" className="modal-title">⚔ Coin New Monster Type</h3>

        <form onSubmit={(e) => { void handleSubmit(e); }} noValidate>
          <div className="form-field">
            <label htmlFor="coin-type-name" className="form-label">
              Name <span aria-hidden="true">*</span>
            </label>
            <input
              id="coin-type-name"
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => { setName(e.target.value); if (nameError) setNameError(null); }}
              onBlur={handleNameBlur}
              maxLength={60}
              required
              aria-required="true"
              aria-describedby={nameError ? 'coin-type-name-error' : undefined}
              aria-invalid={nameError !== null ? 'true' : 'false'}
              disabled={isSubmitting}
            />
            {nameError && (
              <p id="coin-type-name-error" role="alert" className="field-error">{nameError}</p>
            )}
          </div>

          <fieldset className="form-fieldset" disabled={isSubmitting}>
            <legend className="form-label">
              Sprite <span aria-hidden="true">*</span>
            </legend>
            <div
              className="sprite-picker-grid"
              role="group"
              aria-label="Monster sprite"
              onKeyDown={handleSpriteKeyDown}
              aria-describedby={spriteError ? 'coin-type-sprite-error' : undefined}
            >
              {MONSTER_SPRITE_OPTIONS.map((opt, i) => (
                <button
                  key={opt.path}
                  ref={(el) => { spriteBtnRefs.current[i] = el; }}
                  type="button"
                  className={`sprite-option${selectedSpriteIndex === i ? ' sprite-option--selected' : ''}`}
                  aria-pressed={selectedSpriteIndex === i}
                  aria-label={opt.label}
                  tabIndex={activeTabIndex === i ? 0 : -1}
                  onClick={() => selectSprite(i)}
                >
                  <img src={opt.path} alt="" className="sprite-option-img" />
                </button>
              ))}
            </div>
            {spriteError && (
              <p id="coin-type-sprite-error" role="alert" className="field-error">{spriteError}</p>
            )}
          </fieldset>

          <div className="form-field">
            <label htmlFor="coin-type-difficulty" className="form-label">
              Default difficulty
            </label>
            <select
              id="coin-type-difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              disabled={isSubmitting}
            >
              <option value={1}>1★</option>
              <option value={2}>2★</option>
              <option value={3}>3★</option>
              <option value={4}>4★</option>
              <option value={5}>5★</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="coin-type-signature" className="form-label">
              Failure signature (regex) <span aria-hidden="true">*</span>
            </label>
            <input
              id="coin-type-signature"
              type="text"
              className="form-input"
              value={signature}
              onChange={(e) => handleSignatureChange(e.target.value)}
              onBlur={handleSignatureBlur}
              placeholder="e.g. eslint.*unused-vars"
              required
              aria-required="true"
              aria-describedby={signatureError ? 'coin-type-signature-error' : undefined}
              aria-invalid={signatureError !== null ? 'true' : 'false'}
              disabled={isSubmitting}
            />
            {signatureError && (
              <p id="coin-type-signature-error" role="alert" className="field-error">
                {signatureError}
              </p>
            )}
          </div>

          {successMsg && (
            <p role="status" aria-live="polite" className="forge-success">{successMsg}</p>
          )}
          {submitError && (
            <p role="alert" aria-live="assertive" className="form-error">{submitError}</p>
          )}

          <div className="form-actions" aria-live="polite" aria-busy={isSubmitting}>
            <button
              ref={cancelRef}
              type="button"
              className="btn-secondary"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitDisabled}
              aria-label={isSubmitting ? 'Coining type…' : 'Coin monster type'}
            >
              {isSubmitting ? 'Coining…' : '⚔ Coin Type'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
