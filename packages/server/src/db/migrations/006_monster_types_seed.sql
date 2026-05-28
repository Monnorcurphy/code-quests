-- Seed the 10 built-in monster types.
-- INSERT OR IGNORE makes this migration idempotent.

INSERT OR IGNORE INTO monster_types (id, name, sprite_path, default_difficulty, failure_signature, created_by) VALUES
  ('goblin_linter',      'Goblin', 'monsters/goblin.png',  1, '\b(lint|eslint|tslint|clippy)\b',                                                          'system'),
  ('imp_typecheck',      'Imp',    'monsters/imp.png',     2, '\b(typescript|type ?error|TS\d{4}|cannot find name|is not assignable)\b',                  'system'),
  ('wraith_flaky_test',  'Wraith', 'monsters/wraith.png',  3, '\b(flaky|intermittent|sometimes fails|retry passed)\b',                                    'system'),
  ('ogre_failing_test',  'Ogre',   'monsters/ogre.png',    3, '\b(test (failed|failing)|expect.*received|assertion failed)\b',                            'system'),
  ('hydra_ac_mismatch',  'Hydra',  'monsters/hydra.png',   4, '\b(acceptance (criteri[ao]n)|AC mismatch|did not meet|spec mismatch)\b',                   'system'),
  ('mimic_silent_failure','Mimic', 'monsters/mimic.png',   4, '\b(silent failure|wrong behaviou?r|passes but)\b',                                         'system'),
  ('wizard_env_or_dep',  'Wizard', 'monsters/wizard.png',  3, '\b(env|dependency|package not found|ENOENT|module not found)\b',                           'system'),
  ('troll_build_fail',   'Troll',  'monsters/troll.png',   4, '\b(build failed|cannot compile|compilation error)\b',                                      'system'),
  ('lich_repeated_failure','Lich', 'monsters/lich.png',    5, '\b(repeated failure|same failure (3|three))\b',                                            'system'),
  ('dragon_epic_obstacle','Dragon','monsters/dragon.png',  5, '\b(epic|huge|massive scope|too large)\b',                                                  'system');
