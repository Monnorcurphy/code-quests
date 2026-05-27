import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({ default: vi.fn() }));
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import { openDb } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { createQuestsRouter } from '../routes/quests';
import { errorHandler } from '../middleware/errors';
import type { AgentEvent } from '@code-quests/shared';

const publishedEvents: { questId: string; event: AgentEvent }[] = [];

function makeApp() {
  const db = openDb(':memory:');
  runMigrations(db);
  const app = express();
  app.use(express.json());
  const channel = {
    publishQuestEvent: (questId: string, event: AgentEvent) => {
      publishedEvents.push({ questId, event });
    },
  };
  app.use('/quests', createQuestsRouter(db, () => channel));
  app.use(errorHandler);
  return { app, db };
}

function seedQuestWithAgent(
  db: Database.Database,
  opts: { questId?: string; currentScene?: string; questStatus?: string; withActiveAgent?: boolean } = {},
) {
  const questId = opts.questId ?? 'q-test';
  const currentScene = opts.currentScene ?? 'quest-forest';
  const questStatus = opts.questStatus ?? 'active';

  // Ensure a seeded adventurer exists
  const advId = `adv-seed-${questId}`;
  db.prepare(
    "INSERT OR IGNORE INTO adventurers (id, name, class, model_id) VALUES (?, 'Hero', 'champion', 'claude-opus-4-7')",
  ).run(advId);

  db.prepare(
    "INSERT INTO quests (id, title, status, current_scene, adventurer_id) VALUES (?, 'Test Quest', ?, ?, ?)",
  ).run(questId, questStatus, currentScene, advId);

  if (opts.withActiveAgent !== false) {
    db.prepare(
      "INSERT INTO agents (id, quest_id, adventurer_id, started_at) VALUES (?, ?, ?, ?)",
    ).run(`agent-${questId}`, questId, advId, new Date().toISOString());
  }

  return questId;
}

describe('POST /quests/:id/advance-scene', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    publishedEvents.length = 0;
    ({ app, db } = makeApp());
  });

  afterEach(() => {
    db.close();
  });

  it('advances quest from forest to cave (happy path)', async () => {
    const questId = seedQuestWithAgent(db, { currentScene: 'quest-forest' });

    const res = await request(app)
      .post(`/quests/${questId}/advance-scene`)
      .send({ expectedFrom: 'quest-forest' });

    expect(res.status).toBe(200);
    expect(res.body.currentScene).toBe('quest-cave');
    expect(res.body.advanced).toBe(true);
  });

  it('emits a scene_change event on successful advance', async () => {
    const questId = seedQuestWithAgent(db, { currentScene: 'quest-forest' });

    await request(app)
      .post(`/quests/${questId}/advance-scene`)
      .send({ expectedFrom: 'quest-forest' });

    expect(publishedEvents).toHaveLength(1);
    const evt = publishedEvents[0];
    expect(evt?.questId).toBe(questId);
    expect(evt?.event.type).toBe('scene_change');
    if (evt?.event.type === 'scene_change') {
      expect(evt.event.from).toBe('quest-forest');
      expect(evt.event.to).toBe('quest-cave');
    }
  });

  it('persists the new scene in the database', async () => {
    const questId = seedQuestWithAgent(db, { currentScene: 'quest-cave' });

    await request(app)
      .post(`/quests/${questId}/advance-scene`)
      .send({ expectedFrom: 'quest-cave' });

    const row = db.prepare('SELECT current_scene FROM quests WHERE id = ?').get(questId) as { current_scene: string };
    expect(row.current_scene).toBe('quest-dungeon');
  });

  it('returns 409 when expectedFrom does not match current_scene (stale client)', async () => {
    const questId = seedQuestWithAgent(db, { currentScene: 'quest-cave' });

    const res = await request(app)
      .post(`/quests/${questId}/advance-scene`)
      .send({ expectedFrom: 'quest-forest' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('scene_state_mismatch');
    expect(res.body.currentScene).toBe('quest-cave');
  });

  it('returns 200 with advanced=false at boss-room (terminal scene)', async () => {
    const questId = seedQuestWithAgent(db, { currentScene: 'quest-boss-room' });

    const res = await request(app)
      .post(`/quests/${questId}/advance-scene`)
      .send({ expectedFrom: 'quest-boss-room' });

    expect(res.status).toBe(200);
    expect(res.body.currentScene).toBe('quest-boss-room');
    expect(res.body.advanced).toBe(false);
  });

  it('does not emit an event when already at boss-room', async () => {
    const questId = seedQuestWithAgent(db, { currentScene: 'quest-boss-room' });

    await request(app)
      .post(`/quests/${questId}/advance-scene`)
      .send({ expectedFrom: 'quest-boss-room' });

    expect(publishedEvents).toHaveLength(0);
  });

  it('returns 401 when there is no active agent for the quest', async () => {
    const questId = seedQuestWithAgent(db, { withActiveAgent: false });

    const res = await request(app)
      .post(`/quests/${questId}/advance-scene`)
      .send({ expectedFrom: 'quest-forest' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeTruthy();
  });

  it('returns 401 when agent has ended (ended_at is set)', async () => {
    const questId = seedQuestWithAgent(db, { withActiveAgent: false });
    const advId = `adv-seed-${questId}`;
    db.prepare(
      "INSERT INTO agents (id, quest_id, adventurer_id, started_at, ended_at) VALUES (?, ?, ?, ?, ?)",
    ).run('agent-ended', questId, advId, new Date().toISOString(), new Date().toISOString());

    const res = await request(app)
      .post(`/quests/${questId}/advance-scene`)
      .send({ expectedFrom: 'quest-forest' });

    expect(res.status).toBe(401);
  });

  it('returns 404 for a non-existent quest', async () => {
    const res = await request(app)
      .post('/quests/nonexistent/advance-scene')
      .send({ expectedFrom: 'quest-forest' });

    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid body (missing expectedFrom)', async () => {
    const questId = seedQuestWithAgent(db);

    const res = await request(app)
      .post(`/quests/${questId}/advance-scene`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid expectedFrom value', async () => {
    const questId = seedQuestWithAgent(db);

    const res = await request(app)
      .post(`/quests/${questId}/advance-scene`)
      .send({ expectedFrom: 'not-a-valid-scene' });

    expect(res.status).toBe(400);
  });

  it('full advancement chain: forest → cave → dungeon → boss-room → terminal', async () => {
    const questId = seedQuestWithAgent(db, { currentScene: 'quest-forest' });

    const scenes = ['quest-forest', 'quest-cave', 'quest-dungeon'];
    const expected = ['quest-cave', 'quest-dungeon', 'quest-boss-room'];

    for (let i = 0; i < scenes.length; i++) {
      const res = await request(app)
        .post(`/quests/${questId}/advance-scene`)
        .send({ expectedFrom: scenes[i] });
      expect(res.status).toBe(200);
      expect(res.body.currentScene).toBe(expected[i]);
      expect(res.body.advanced).toBe(true);
    }

    const terminalRes = await request(app)
      .post(`/quests/${questId}/advance-scene`)
      .send({ expectedFrom: 'quest-boss-room' });
    expect(terminalRes.status).toBe(200);
    expect(terminalRes.body.advanced).toBe(false);
  });
});
