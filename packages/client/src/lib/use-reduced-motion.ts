import { useState, useEffect } from 'react';

function isReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.getAttribute('data-reduced-motion') === 'true'
  );
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(isReducedMotion);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => setReduced(isReducedMotion());

    mql.addEventListener('change', handleChange);

    const observer = new MutationObserver(handleChange);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-reduced-motion'],
    });

    return () => {
      mql.removeEventListener('change', handleChange);
      observer.disconnect();
    };
  }, []);

  return reduced;
}
