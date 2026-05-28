export function DifficultyStars({ value, max = 5 }: { value: number; max?: number }) {
  const clamped = Math.max(0, Math.min(value, max));
  const filled = '★'.repeat(clamped);
  const empty = '☆'.repeat(max - clamped);
  return (
    <span className="difficulty-stars" aria-label={`${clamped} of ${max} stars`}>
      {filled}{empty}
    </span>
  );
}
