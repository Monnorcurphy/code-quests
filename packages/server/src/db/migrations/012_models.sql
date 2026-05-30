-- Multi-model support: a user can register any number of models from
-- different providers (claude CLI, OpenRouter, Ollama, …) and pick one
-- per quest. API keys live in the OS keychain, not this table.

CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL
    CHECK(provider IN ('claude_cli', 'openrouter', 'ollama', 'anthropic_api', 'openai')),
  model_id TEXT NOT NULL,
  -- Free-form JSON for provider-specific extras (e.g. ollama base URL,
  -- openrouter site headers). Never includes secrets.
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_models_last_used_at ON models(last_used_at DESC);

-- Per-quest model selection. Nullable so existing quests survive — new
-- quests dispatched against the real-agent path must set it.
ALTER TABLE quests ADD COLUMN model_id TEXT REFERENCES models(id);
CREATE INDEX IF NOT EXISTS idx_quests_model_id ON quests(model_id);
