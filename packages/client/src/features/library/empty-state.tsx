export default function BestiaryEmptyState() {
  return (
    <div className="bestiary-empty" role="status">
      <p className="bestiary-empty-message">No monsters encountered yet.</p>
      <p className="bestiary-empty-hint">
        Run a quest in the Town Square — they'll show up here as your adventurers face them.
      </p>
    </div>
  );
}
