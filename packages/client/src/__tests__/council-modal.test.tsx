import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CouncilModal from '../features/council/council-modal';
import { api, ApiError } from '../lib/api';

vi.mock('../lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/api')>();
  return {
    ...original,
    api: {
      ...original.api,
      models: {
        list: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        delete: vi.fn(),
      },
      council: {
        consult: vi.fn(),
      },
    },
  };
});

function mountModal(opts?: { defaultModelId?: string | null }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CouncilModal
        draftQuest={{
          title: 'Make a hello world',
          description: 'Vague description',
          acceptanceCriteria: ['It says hello'],
        }}
        defaultModelId={opts?.defaultModelId ?? null}
        onClose={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe('CouncilModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a helpful message when no eligible models are configured', async () => {
    vi.mocked(api.models.list).mockResolvedValue([]);
    mountModal();
    await waitFor(() => {
      expect(
        screen.getByText(/no model available for council/i),
      ).toBeInTheDocument();
    });
  });

  it('skips claude_cli models in the picker', async () => {
    vi.mocked(api.models.list).mockResolvedValue([
      {
        id: 'cc-1', name: 'CLI Sonnet', provider: 'claude_cli', modelId: 'sonnet',
        config: {}, createdAt: '2026-01-01', lastUsedAt: null, hasKey: false,
      },
      {
        id: 'ol-1', name: 'Local Llama', provider: 'ollama', modelId: 'llama3.1:70b',
        config: {}, createdAt: '2026-01-02', lastUsedAt: null, hasKey: false,
      },
    ]);
    mountModal();
    await waitFor(() => {
      const select = screen.getByTestId('council-model-select') as HTMLSelectElement;
      expect(select.options).toHaveLength(1);
      expect(select.options[0]!.text).toContain('Local Llama');
    });
  });

  it('auto-picks an ollama model as default council', async () => {
    vi.mocked(api.models.list).mockResolvedValue([
      {
        id: 'or-1', name: 'OR Sonnet', provider: 'openrouter', modelId: 'sonnet',
        config: {}, createdAt: '2026-01-01', lastUsedAt: null, hasKey: true,
      },
      {
        id: 'ol-1', name: 'Local Llama', provider: 'ollama', modelId: 'llama3.1:70b',
        config: {}, createdAt: '2026-01-02', lastUsedAt: null, hasKey: false,
      },
    ]);
    mountModal();
    await waitFor(() => {
      const select = screen.getByTestId('council-model-select') as HTMLSelectElement;
      expect(select.value).toBe('ol-1');
    });
  });

  it('sends the user message + draft + model to /council/consult and renders the reply', async () => {
    vi.mocked(api.models.list).mockResolvedValue([
      {
        id: 'ol-1', name: 'Local Llama', provider: 'ollama', modelId: 'llama3.1:70b',
        config: {}, createdAt: '2026-01-02', lastUsedAt: null, hasKey: false,
      },
    ]);
    vi.mocked(api.council.consult).mockResolvedValue({
      reply: 'Sharpen the title and add a stack to the description.',
      modelName: 'Local Llama',
      provider: 'ollama',
    });

    mountModal();
    const user = userEvent.setup();

    // Wait for the auto-picked model so the Send button is enabled.
    await waitFor(() => {
      const sel = screen.getByTestId('council-model-select') as HTMLSelectElement;
      expect(sel.value).toBe('ol-1');
    });
    const input = await screen.findByTestId('council-input');
    await user.type(input, 'What should I sharpen?');
    await user.click(screen.getByRole('button', { name: /send to council/i }));

    await waitFor(() => {
      expect(api.council.consult).toHaveBeenCalledTimes(1);
    });
    const arg = vi.mocked(api.council.consult).mock.calls[0]![0];
    expect(arg.modelId).toBe('ol-1');
    expect(arg.userMessage).toBe('What should I sharpen?');
    expect(arg.draftQuest.title).toBe('Make a hello world');
    expect(arg.history).toEqual([]);

    await waitFor(() => {
      expect(screen.getByText(/sharpen the title/i)).toBeInTheDocument();
    });
  });

  it('appends turns to history across multiple sends', async () => {
    vi.mocked(api.models.list).mockResolvedValue([
      {
        id: 'ol-1', name: 'Local Llama', provider: 'ollama', modelId: 'llama3.1:70b',
        config: {}, createdAt: '2026-01-02', lastUsedAt: null, hasKey: false,
      },
    ]);
    vi.mocked(api.council.consult)
      .mockResolvedValueOnce({ reply: 'First reply.', modelName: 'L', provider: 'ollama' })
      .mockResolvedValueOnce({ reply: 'Second reply.', modelName: 'L', provider: 'ollama' });

    mountModal();
    const user = userEvent.setup();
    await waitFor(() => {
      const sel = screen.getByTestId('council-model-select') as HTMLSelectElement;
      expect(sel.value).toBe('ol-1');
    });
    const input = await screen.findByTestId('council-input');

    await user.type(input, 'first');
    await user.click(screen.getByRole('button', { name: /send to council/i }));
    await waitFor(() => screen.getByText('First reply.'));

    await user.type(input, 'second');
    await user.click(screen.getByRole('button', { name: /send to council/i }));
    await waitFor(() => screen.getByText('Second reply.'));

    const lastArg = vi.mocked(api.council.consult).mock.calls[1]![0];
    expect(lastArg.history).toEqual([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'First reply.' },
    ]);
  });

  it('shows server errors and does not append a turn on failure', async () => {
    vi.mocked(api.models.list).mockResolvedValue([
      {
        id: 'or-1', name: 'OR Sonnet', provider: 'openrouter', modelId: 'sonnet',
        config: {}, createdAt: '2026-01-01', lastUsedAt: null, hasKey: false,
      },
    ]);
    vi.mocked(api.council.consult).mockRejectedValue(
      new ApiError('Model "OR Sonnet" requires an API key', {
        status: 409,
        data: { code: 'NO_KEY' },
      }),
    );

    mountModal();
    const user = userEvent.setup();
    await waitFor(() => {
      const sel = screen.getByTestId('council-model-select') as HTMLSelectElement;
      expect(sel.value).toBe('or-1');
    });
    const input = await screen.findByTestId('council-input');
    await user.type(input, 'hello');
    await user.click(screen.getByRole('button', { name: /send to council/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/requires an API key/i);
    });
  });

  it('disables Send while a turn is in flight', async () => {
    vi.mocked(api.models.list).mockResolvedValue([
      {
        id: 'ol-1', name: 'Local Llama', provider: 'ollama', modelId: 'llama3.1:70b',
        config: {}, createdAt: '2026-01-02', lastUsedAt: null, hasKey: false,
      },
    ]);
    let resolve!: (v: {
      reply: string; modelName: string; provider: string;
    }) => void;
    vi.mocked(api.council.consult).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );

    mountModal();
    const user = userEvent.setup();
    await waitFor(() => {
      const sel = screen.getByTestId('council-model-select') as HTMLSelectElement;
      expect(sel.value).toBe('ol-1');
    });
    const input = await screen.findByTestId('council-input');
    await user.type(input, 'hi');
    await user.click(screen.getByRole('button', { name: /send to council/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /asking/i })).toBeDisabled();
    });

    resolve({ reply: 'ok', modelName: 'L', provider: 'ollama' });
    await waitFor(() => {
      expect(screen.getByText('ok')).toBeInTheDocument();
    });
  });
});
