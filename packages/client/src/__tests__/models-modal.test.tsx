import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ModelsModal from '../features/models/models-modal';
import { api, type ReturnedModel } from '../lib/api';

vi.mock('../lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/api')>();
  return {
    ...original,
    api: {
      ...original.api,
      models: {
        list: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

const sampleModel = (over: Partial<ReturnedModel> = {}): ReturnedModel => ({
  id: 'm-1',
  name: 'Sonnet',
  provider: 'claude_cli',
  modelId: 'sonnet',
  config: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  lastUsedAt: null,
  hasKey: false,
  ...over,
});

function renderModal(props: { onClose?: () => void } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ModelsModal onClose={props.onClose ?? vi.fn()} />
      </QueryClientProvider>,
    ),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.models.list).mockResolvedValue([]);
});

afterEach(() => {
  // no-op
});

describe('ModelsModal', () => {
  it('shows the empty-state hint when no models exist', async () => {
    renderModal();
    expect(screen.getByRole('dialog', { name: 'Models' })).toBeDefined();
    await waitFor(() => {
      expect(screen.getByText(/No models yet/i)).toBeDefined();
    });
  });

  it('lists existing models with provider/modelId and a hasKey badge', async () => {
    vi.mocked(api.models.list).mockResolvedValue([
      sampleModel({ id: 'm-1', name: 'Sonnet via OR', provider: 'openrouter', modelId: 'anthropic/claude-3.5-sonnet', hasKey: true }),
      sampleModel({ id: 'm-2', name: 'Local Llama', provider: 'ollama', modelId: 'llama3.1:70b', hasKey: false }),
    ]);

    renderModal();
    await waitFor(() => {
      expect(screen.getByText('Sonnet via OR')).toBeDefined();
      expect(screen.getByText('Local Llama')).toBeDefined();
    });
    expect(screen.getByText(/openrouter · anthropic\/claude-3.5-sonnet/)).toBeDefined();
    expect(screen.getByText(/ollama · llama3.1:70b/)).toBeDefined();
    // Badges
    expect(screen.getByLabelText('API key configured')).toBeDefined();
    expect(screen.getByLabelText('API key missing')).toBeDefined();
  });

  it('adds an OpenRouter model with apiKey and surfaces it in the list', async () => {
    const created = sampleModel({
      id: 'm-new',
      name: 'OR Sonnet',
      provider: 'openrouter',
      modelId: 'anthropic/claude-3.5-sonnet',
      hasKey: true,
    });
    let firstList = true;
    vi.mocked(api.models.list).mockImplementation(async () => {
      if (firstList) {
        firstList = false;
        return [];
      }
      return [created];
    });
    vi.mocked(api.models.create).mockResolvedValue(created);

    const user = userEvent.setup();
    renderModal();
    await waitFor(() => expect(screen.getByText(/No models yet/i)).toBeDefined());

    await user.click(screen.getByLabelText('OpenRouter'));
    await user.type(screen.getByLabelText('Display name'), 'OR Sonnet');
    await user.type(screen.getByLabelText('Model identifier'), 'anthropic/claude-3.5-sonnet');
    await user.type(screen.getByLabelText('API key'), 'sk-or-abc');
    await user.click(screen.getByRole('button', { name: 'Add Model' }));

    await waitFor(() => {
      expect(vi.mocked(api.models.create)).toHaveBeenCalledWith({
        name: 'OR Sonnet',
        provider: 'openrouter',
        modelId: 'anthropic/claude-3.5-sonnet',
        config: {},
        apiKey: 'sk-or-abc',
      });
    });
    await waitFor(() => {
      expect(screen.getByText('OR Sonnet')).toBeDefined();
    });
  });

  it('adds an Ollama model without rendering an apiKey field or sending one', async () => {
    const created = sampleModel({
      id: 'm-llama',
      name: 'Llama 3.1',
      provider: 'ollama',
      modelId: 'llama3.1:70b',
      hasKey: false,
    });
    vi.mocked(api.models.create).mockResolvedValue(created);

    const user = userEvent.setup();
    renderModal();
    await waitFor(() => expect(screen.getByText(/No models yet/i)).toBeDefined());

    await user.click(screen.getByLabelText('Ollama'));
    // API key field must NOT be rendered for Ollama.
    expect(screen.queryByLabelText('API key')).toBeNull();
    await user.type(screen.getByLabelText('Display name'), 'Llama 3.1');
    await user.type(screen.getByLabelText('Model identifier'), 'llama3.1:70b');
    await user.click(screen.getByRole('button', { name: 'Add Model' }));

    await waitFor(() => {
      expect(vi.mocked(api.models.create)).toHaveBeenCalledWith({
        name: 'Llama 3.1',
        provider: 'ollama',
        modelId: 'llama3.1:70b',
        config: {},
      });
    });
    const call = vi.mocked(api.models.create).mock.calls[0]?.[0];
    expect(call && 'apiKey' in call).toBe(false);
  });

  it('deletes a model and refreshes the list', async () => {
    const existing = sampleModel({ id: 'm-1', name: 'Sonnet', provider: 'claude_cli', modelId: 'sonnet', hasKey: false });
    let listed = [existing];
    vi.mocked(api.models.list).mockImplementation(async () => listed);
    vi.mocked(api.models.delete).mockImplementation(async () => {
      listed = [];
    });

    const user = userEvent.setup();
    renderModal();
    await waitFor(() => expect(screen.getByText('Sonnet')).toBeDefined());

    await user.click(screen.getByRole('button', { name: 'Delete model Sonnet' }));

    await waitFor(() => {
      expect(vi.mocked(api.models.delete)).toHaveBeenCalledWith('m-1');
    });
    await waitFor(() => {
      expect(screen.queryByText('Sonnet')).toBeNull();
      expect(screen.getByText(/No models yet/i)).toBeDefined();
    });
  });
});
