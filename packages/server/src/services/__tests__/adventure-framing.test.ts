import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../agents/haiku-adapter', () => ({
  createHaikuAdapter: vi.fn(),
  MissingApiKeyError: class MissingApiKeyError extends Error {
    constructor() {
      super('ANTHROPIC_API_KEY is not set');
      this.name = 'MissingApiKeyError';
    }
  },
}));

import { createHaikuAdapter } from '../../agents/haiku-adapter';
import { frameInputRequest, frameUserBlocker } from '../adventure-framing';

type MockAdapter = { name: string; complete: ReturnType<typeof vi.fn> };

function makeAdapter(returnValue: string): MockAdapter {
  return { name: 'haiku', complete: vi.fn().mockResolvedValue(returnValue) };
}

describe('frameInputRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns haiku framing when adapter succeeds', async () => {
    vi.mocked(createHaikuAdapter).mockReturnValue(makeAdapter('Brielle has reached a sealed door.') as never);
    const result = await frameInputRequest('What API key?', 'Brielle');
    expect(result).toBe('Brielle has reached a sealed door.');
    expect(createHaikuAdapter).toHaveBeenCalledOnce();
  });

  it('passes adventurer name and question to haiku', async () => {
    const adapter = makeAdapter('Gareth pauses at the fork.');
    vi.mocked(createHaikuAdapter).mockReturnValue(adapter as never);
    await frameInputRequest('Which path?', 'Gareth', 'Forest crossroads');
    const { prompt } = adapter.complete.mock.calls[0][0] as { prompt: string };
    expect(prompt).toContain('Gareth');
    expect(prompt).toContain('Which path?');
    expect(prompt).toContain('Forest crossroads');
  });

  it('returns deterministic fallback when createHaikuAdapter throws', async () => {
    vi.mocked(createHaikuAdapter).mockImplementation(() => {
      throw new Error('ANTHROPIC_API_KEY is not set');
    });
    const result = await frameInputRequest('Which approach?', 'Gareth');
    expect(result).toBe('Gareth pauses on the path and asks: "Which approach?"');
  });

  it('returns fallback when adapter.complete rejects', async () => {
    const adapter = { name: 'haiku', complete: vi.fn().mockRejectedValue(new Error('network error')) };
    vi.mocked(createHaikuAdapter).mockReturnValue(adapter as never);
    const result = await frameInputRequest('Which approach?', 'Gareth');
    expect(result).toBe('Gareth pauses on the path and asks: "Which approach?"');
  });

  it('returns fallback when adapter returns empty string', async () => {
    vi.mocked(createHaikuAdapter).mockReturnValue(makeAdapter('') as never);
    const result = await frameInputRequest('Which approach?', 'Gareth');
    expect(result).toBe('Gareth pauses on the path and asks: "Which approach?"');
  });

  it('returns fallback when adapter returns only whitespace', async () => {
    vi.mocked(createHaikuAdapter).mockReturnValue(makeAdapter('   ') as never);
    const result = await frameInputRequest('Which approach?', 'Gareth');
    expect(result).toBe('Gareth pauses on the path and asks: "Which approach?"');
  });

  it('caps output at 200 chars', async () => {
    const long = 'A'.repeat(300);
    vi.mocked(createHaikuAdapter).mockReturnValue(makeAdapter(long) as never);
    const result = await frameInputRequest('question', 'Name');
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it('strips HTML tags (no script tags survive)', async () => {
    vi.mocked(createHaikuAdapter).mockReturnValue(
      makeAdapter('<script>alert("xss")</script>The hero proceeds.') as never,
    );
    const result = await frameInputRequest('question', 'Name');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('<');
  });

  it('strips any HTML tags', async () => {
    vi.mocked(createHaikuAdapter).mockReturnValue(
      makeAdapter('<b>Bold</b> hero walks <em>forward</em>.') as never,
    );
    const result = await frameInputRequest('question', 'Name');
    expect(result).toBe('Bold hero walks forward.');
  });

  it('collapses newlines to spaces', async () => {
    vi.mocked(createHaikuAdapter).mockReturnValue(
      makeAdapter('Line one\nLine two') as never,
    );
    const result = await frameInputRequest('question', 'Name');
    expect(result).not.toContain('\n');
    expect(result).toContain('Line one');
    expect(result).toContain('Line two');
  });

  it('collapses carriage-return newlines', async () => {
    vi.mocked(createHaikuAdapter).mockReturnValue(
      makeAdapter('Line one\r\nLine two') as never,
    );
    const result = await frameInputRequest('question', 'Name');
    expect(result).not.toContain('\r');
    expect(result).not.toContain('\n');
  });

  it('fallback includes both adventurer name and question', async () => {
    vi.mocked(createHaikuAdapter).mockImplementation(() => {
      throw new Error('offline');
    });
    const result = await frameInputRequest('Need the runed key', 'Brielle');
    expect(result).toContain('Brielle');
    expect(result).toContain('Need the runed key');
  });

  it('fallback is capped at 200 chars when question is very long', async () => {
    vi.mocked(createHaikuAdapter).mockImplementation(() => {
      throw new Error('offline');
    });
    const longQuestion = 'Q'.repeat(300);
    const result = await frameInputRequest(longQuestion, 'Name');
    expect(result.length).toBeLessThanOrEqual(200);
  });
});

describe('frameUserBlocker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns haiku framing when adapter succeeds', async () => {
    vi.mocked(createHaikuAdapter).mockReturnValue(
      makeAdapter('Elena halts, awaiting a raven from the guild.') as never,
    );
    const result = await frameUserBlocker('Waiting for design review', 'Elena');
    expect(result).toBe('Elena halts, awaiting a raven from the guild.');
  });

  it('passes adventurer name and description to haiku', async () => {
    const adapter = makeAdapter('Elena waits.');
    vi.mocked(createHaikuAdapter).mockReturnValue(adapter as never);
    await frameUserBlocker('Awaiting approval from the council', 'Elena');
    const { prompt } = adapter.complete.mock.calls[0][0] as { prompt: string };
    expect(prompt).toContain('Elena');
    expect(prompt).toContain('Awaiting approval from the council');
  });

  it('returns deterministic fallback when createHaikuAdapter throws', async () => {
    vi.mocked(createHaikuAdapter).mockImplementation(() => {
      throw new Error('offline');
    });
    const result = await frameUserBlocker('Waiting on approval', 'Elena');
    expect(result).toBe('Elena halts to seek counsel: "Waiting on approval"');
  });

  it('returns fallback when adapter.complete rejects', async () => {
    const adapter = { name: 'haiku', complete: vi.fn().mockRejectedValue(new Error('timeout')) };
    vi.mocked(createHaikuAdapter).mockReturnValue(adapter as never);
    const result = await frameUserBlocker('Waiting on approval', 'Elena');
    expect(result).toBe('Elena halts to seek counsel: "Waiting on approval"');
  });

  it('returns fallback when adapter returns empty string', async () => {
    vi.mocked(createHaikuAdapter).mockReturnValue(makeAdapter('') as never);
    const result = await frameUserBlocker('description', 'Elena');
    expect(result).toBe('Elena halts to seek counsel: "description"');
  });

  it('strips HTML tags', async () => {
    vi.mocked(createHaikuAdapter).mockReturnValue(
      makeAdapter('<b>Elena</b> waits for the council.') as never,
    );
    const result = await frameUserBlocker('description', 'Elena');
    expect(result).not.toContain('<b>');
    expect(result).not.toContain('<');
  });

  it('caps output at 200 chars', async () => {
    const long = 'B'.repeat(300);
    vi.mocked(createHaikuAdapter).mockReturnValue(makeAdapter(long) as never);
    const result = await frameUserBlocker('description', 'Name');
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it('fallback includes both adventurer name and description', async () => {
    vi.mocked(createHaikuAdapter).mockImplementation(() => {
      throw new Error('offline');
    });
    const result = await frameUserBlocker('waiting for PR review', 'Theron');
    expect(result).toContain('Theron');
    expect(result).toContain('waiting for PR review');
  });
});
