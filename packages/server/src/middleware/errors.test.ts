import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { errorHandler } from './errors';

function makeApp() {
  const app = express();
  app.get('/boom', () => {
    throw new Error('test explosion');
  });
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 500 JSON when a route throws', async () => {
    const app = makeApp();
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });

  it('writes the error to stderr', async () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const app = makeApp();
    await request(app).get('/boom');
    expect(spy).toHaveBeenCalledOnce();
    const written = spy.mock.calls[0][0] as string;
    expect(written).toContain('test explosion');
  });
});
