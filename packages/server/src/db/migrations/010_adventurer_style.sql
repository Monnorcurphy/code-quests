-- Wardrobe MVP: per-adventurer style preferences (tunic + hair color).
-- Stored as JSON so we can grow the shape (eyes, accessories) without further migrations.
ALTER TABLE adventurers ADD COLUMN style_json TEXT NOT NULL DEFAULT '{}';
