import { useEffect, useRef, useState } from 'react';
import { subscribeCue } from '../audio-cue-bus';
import { useReducedMotion } from '../../lib/use-reduced-motion';

export default function PauseBellFlash() {
  const [active, setActive] = useState(false);
  const reducedMotion = useReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return subscribeCue((event) => {
      if (event !== 'PAUSE_BELL') return;
      if (timerRef.current) clearTimeout(timerRef.current);
      setActive(true);
      timerRef.current = setTimeout(
        () => setActive(false),
        reducedMotionRef.current ? 1500 : 300,
      );
    });
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!active) return null;

  return (
    <div
      className={`pause-bell-flash${reducedMotion ? ' pause-bell-flash--static' : ''}`}
      aria-hidden="true"
      data-testid="pause-bell-flash"
    />
  );
}
