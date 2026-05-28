ALTER TABLE quests ADD COLUMN current_scene TEXT NOT NULL DEFAULT 'quest-forest'
  CHECK (current_scene IN ('quest-forest','quest-cave','quest-dungeon','quest-boss-room'));

UPDATE quests SET current_scene = 'quest-forest' WHERE current_scene IS NULL OR current_scene = '';
