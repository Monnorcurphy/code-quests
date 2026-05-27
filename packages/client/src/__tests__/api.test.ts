import { describe, it, expect, vi, afterEach } from 'vitest';
import { api, ApiError } from '../lib/api';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchJson error handling', () => {
  it('throws ApiError with correct status when server returns 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Quest not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const err = await api.quests.get('nonexistent').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(404);
    expect((err as ApiError).message).toBe('Quest not found');
  });

  it('throws ApiError with correct status when server returns 500', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const err = await api.quests.get('some-id').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(500);
  });

  it('falls back to status text when response body is not valid JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('not json', { status: 503, statusText: 'Service Unavailable' }),
    );
    const err = await api.quests.get('some-id').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(503);
  });
});
