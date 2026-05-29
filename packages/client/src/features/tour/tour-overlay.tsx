import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTourStore } from '../../stores/tour-store';
import { SHOWCASE_STEPS } from './showcase-steps';

function TourOverlayContent() {
  const { step, totalSteps, nextStep, prevStep, exitTour } = useTourStore();
  const navigate = useNavigate();
  const overlayRef = useRef<HTMLDivElement>(null);
  const prevBtnRef = useRef<HTMLButtonElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const current = SHOWCASE_STEPS[step - 1];
  const isFirst = step === 1;
  const isLast = step === totalSteps;

  // Capture the element focused when the tour opens; restore it on dismiss (review-3)
  useEffect(() => {
    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      const trigger = triggerRef.current;
      if (trigger && document.contains(trigger)) {
        trigger.focus();
      }
    };
  }, []);

  // Navigate to the correct route for this step
  useEffect(() => {
    if (current?.route) {
      navigate(current.route);
    }
  }, [step, current?.route, navigate]);

  // Focus management: focus appropriate button on mount and step changes
  useEffect(() => {
    const btn = isFirst ? nextBtnRef.current : prevBtnRef.current;
    btn?.focus();
  }, [step, isFirst]);

  // Keyboard handler: Escape dismisses, arrow keys advance/back (review-2)
  // No Tab focus trap — this overlay is role="region", not modal (review-4)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        exitTour();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (isLast) {
          exitTour();
        } else {
          nextStep();
        }
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!isFirst) prevStep();
        return;
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [exitTour, nextStep, prevStep, isFirst, isLast]);

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
      role="region"
      aria-label={`Tour: Step ${step} of ${totalSteps}`}
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
