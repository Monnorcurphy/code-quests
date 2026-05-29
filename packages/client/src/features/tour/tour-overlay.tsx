import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTourStore } from '../../stores/tour-store';
import { SHOWCASE_STEPS } from './showcase-steps';

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function TourOverlayContent() {
  const { step, totalSteps, nextStep, prevStep, exitTour } = useTourStore();
  const navigate = useNavigate();
  const overlayRef = useRef<HTMLDivElement>(null);
  const prevBtnRef = useRef<HTMLButtonElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const current = SHOWCASE_STEPS[step - 1];
  const isFirst = step === 1;
  const isLast = step === totalSteps;

  // Navigate to the correct route for this step
  useEffect(() => {
    if (current?.route) {
      navigate(current.route);
    }
  }, [step, current?.route, navigate]);

  // Focus management: focus the overlay on mount and when step changes
  useEffect(() => {
    const btn = isFirst ? nextBtnRef.current : prevBtnRef.current;
    btn?.focus();
  }, [step, isFirst]);

  // Focus trap within overlay
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        exitTour();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = overlayRef.current;
      if (!panel) return;
      const els = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [exitTour]);

  function handleNext() {
    if (isLast) {
      exitTour();
    } else {
      nextStep();
    }
  }

  if (!current) return null;

  return (
    <div
      className="tour-overlay-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-step-title"
      aria-describedby="tour-step-body"
      data-testid="tour-overlay"
    >
      <div ref={overlayRef} className="tour-overlay-panel">
        <div className="tour-overlay-header">
          <span className="tour-overlay-counter" aria-live="polite">
            Tour: Step {step} of {totalSteps}
          </span>
          <button
            ref={closeBtnRef}
            type="button"
            className="tour-overlay-close"
            onClick={exitTour}
            aria-label="Close tour"
          >
            ✕
          </button>
        </div>

        <div aria-live="polite" aria-atomic="true">
          <h2 id="tour-step-title" className="tour-overlay-title">
            {current.title}
          </h2>
          <p id="tour-step-body" className="tour-overlay-body">
            {current.body}
          </p>
        </div>

        <div className="tour-overlay-actions">
          {!isFirst && (
            <button
              ref={prevBtnRef}
              type="button"
              className="btn-secondary tour-overlay-back"
              onClick={prevStep}
            >
              ← Back
            </button>
          )}
          <button
            ref={nextBtnRef}
            type="button"
            className="btn-primary tour-overlay-next"
            onClick={handleNext}
          >
            {isLast ? 'Finish Tour' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TourOverlay() {
  const active = useTourStore((s) => s.active);
  if (!active) return null;

  const portal = document.getElementById('tour-portal') ?? document.body;
  return createPortal(<TourOverlayContent />, portal);
}
