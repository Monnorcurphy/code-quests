-- Phase 3 seed data for skills, tools, and mcp_servers catalogs
-- All inserts use INSERT OR IGNORE for idempotency

INSERT OR IGNORE INTO skills (id, name, monster_type_ids_json, status, created_by, hit_count, implementation)
VALUES
  ('linters_bane',    'Linter''s Bane',   '[]', 'active', 'system', 0, ''),
  ('type_whisperer',  'Type Whisperer',   '[]', 'active', 'system', 0, ''),
  ('wraith_banisher', 'Wraith-Banisher',  '[]', 'active', 'system', 0, ''),
  ('ac_cartographer', 'AC Cartographer',  '[]', 'active', 'system', 0, '');

INSERT OR IGNORE INTO tools (id, name, description, invocation)
VALUES
  ('pnpm',           'pnpm',           'Fast, disk-efficient package manager',          'pnpm <command>'),
  ('gh',             'GitHub CLI',     'Interact with GitHub from the command line',     'gh <command>'),
  ('playwright_cli', 'Playwright CLI', 'Run end-to-end tests with Playwright',           'npx playwright <command>'),
  ('jq',             'jq',             'Command-line JSON processor',                    'jq <filter> [file]');

INSERT OR IGNORE INTO mcp_servers (id, name, config_json)
VALUES
  ('filesystem', 'Filesystem', '{}'),
  ('github',     'GitHub',     '{}');
