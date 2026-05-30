import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createFsRouter } from '../fs';
import { errorHandler } from '../../middleware/errors';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/fs', createFsRouter());
  app.use(errorHandler);
  return app;
}

describe('POST /fs/pick-folder', () => {
  let app: express.Express;
  const originalPlatform = process.platform;

  beforeEach(() => {
    app = makeApp();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('returns 501 with a clear message on non-macOS platforms', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });

    const res = await request(app).post('/fs/pick-folder').send({});
    expect(res.status).toBe(501);
    expect(res.body.error).toMatch(/macOS/);
    expect(res.body.platform).toBe('linux');
  });

  // Note: we don't unit-test the happy path here because it would actually
  // pop a folder picker on the test host. The picker is exercised manually
  // and via the multi-model e2e suite where we don't drive the dialog
  // (we just verify the button exists and is clickable).
});
