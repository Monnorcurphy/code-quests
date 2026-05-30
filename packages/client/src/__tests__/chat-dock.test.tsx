import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ChatDock from '../features/quest/chat-dock';
import { useQuestStore } from '../stores/quest-store';
import type { AgentEvent } from '@code-quests/shared';
import type { ReturnedModel } from '../lib/api';

// --- API mocks ---
const mockRespondInput = vi.fn();
const mockListModels = vi.fn();

vi.mock('../lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/api')>();
  return {
    ...original,
    api: {
      ...original.api,
      quests: {
        ...original.api.quests,
        respondInput: (...args: unknown[]) => mockRespondInput(...args),
      },
      models: {
        ...original.api.models,
        list: (...args: unknown[]) => mockListModels(...args as []),
      },
    },
  };
});

function makeOpenRouterModel(id: string): ReturnedModel {
  return {
    id,
    name: 'Test OR',
    provider: 'openrouter',
    modelId: 'anthropic/claude-3.5-sonnet',
    config: {},
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    hasKey: true,
  };
}

function makeClaudeCliModel(id: string): ReturnedModel {
  return {
    id,
    name: 'Claude CLI',
    provider: 'claude_cli',
    modelId: 'claude-sonnet-4',
    config: {},
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    hasKey: false,
  };
}

function appendEvent(questId: string, event: AgentEvent): void {
  act(() => {
    useQuestStore.getState().appendEvent(questId, event);
  });
}

function renderDock(modelId: string | null = null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ChatDock questId="q-chat" modelId={modelId} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useQuestStore.getState().reset('q-chat');
  mockRespondInput.mockReset();
  mockListModels.mockReset();
  mockListModels.mockResolvedValue([]);
});

afterEach(() => {
  useQuestStore.getState().reset('q-chat');
  vi.clearAllMocks();
});

describe('ChatDock', () => {
  it('shows empty-state copy when there are no messages', () => {
    renderDock();
    expect(
      screen.getByText(/no messages yet/i),
    ).toBeDefined();
    // The Send button exists and is disabled (empty input).
    const send = screen.getByRole('button', { name: /send message/i });
    expect((send as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders user and assistant bubbles from the event store, collapsing repeated assistant progress into one bubble', () => {
    renderDock();
    appendEvent('q-chat', {
      type: 'progress',
      timestamp: new Date().toISOString(),
      message: 'Hello',
      role: 'assistant',
    });
    appendEvent('q-chat', {
      type: 'progress',
      timestamp: new Date().toISOString(),
      message: 'Hello world',
      role: 'assistant',
    });
    appendEvent('q-chat', {
      type: 'log',
      timestamp: new Date().toISOString(),
      message: '[turn_ended]',
    });
    appendEvent('q-chat', {
      type: 'progress',
      timestamp: new Date().toISOString(),
      message: 'how can I help?',
      role: 'user',
    });

    // The two assistant progress events collapse into ONE bubble showing the latest text.
    const assistantBubbles = screen.getAllByText(/Hello world/);
    expect(assistantBubbles).toHaveLength(1);
    // The earlier prefix should not appear as its own bubble.
    expect(screen.queryByText(/^Hello$/)).toBeNull();
    // The user message renders.
    expect(screen.getByText(/how can I help/i)).toBeDefined();
    // Author labels are rendered.
    expect(screen.getAllByText('You').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Adventurer').length).toBeGreaterThan(0);
  });

  it('submitting a message calls api.quests.respondInput with the trimmed text', async () => {
    mockRespondInput.mockResolvedValue({});
    renderDock();
    const user = userEvent.setup();
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, '  do the thing  ');
    const send = screen.getByRole('button', { name: /send message/i });
    expect((send as HTMLButtonElement).disabled).toBe(false);
    await user.click(send);
    await waitFor(() => {
      expect(mockRespondInput).toHaveBeenCalledTimes(1);
    });
    expect(mockRespondInput).toHaveBeenCalledWith('q-chat', 'do the thing');
    // Textarea is cleared after a successful send.
    await waitFor(() => expect((textarea as HTMLTextAreaElement).value).toBe(''));
  });

  it('disables the Send button while an assistant turn is in flight', () => {
    renderDock();
    // Simulate a streaming assistant turn — progress without a trailing
    // [turn_ended] or completed/failed event means a turn is in flight.
    appendEvent('q-chat', {
      type: 'progress',
      timestamp: new Date().toISOString(),
      message: 'streaming…',
      role: 'assistant',
    });
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    // Even with text in the input, the send button stays disabled while
    // turnInFlight is true.
    act(() => {
      textarea.value = 'hi';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const send = screen.getByRole('button', { name: /send message/i });
    expect((send as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the claude_cli unsupported banner when the quest model uses that provider', async () => {
    mockListModels.mockResolvedValue([makeClaudeCliModel('model-cli')]);
    renderDock('model-cli');
    await waitFor(() => {
      expect(screen.getByText(/doesn['’]t support mid-quest replies/i)).toBeDefined();
    });
  });

  it('does not show the unsupported banner for openrouter / ollama providers', async () => {
    mockListModels.mockResolvedValue([makeOpenRouterModel('model-or')]);
    renderDock('model-or');
    // Give the query a chance to resolve.
    await waitFor(() => {
      expect(mockListModels).toHaveBeenCalled();
    });
    expect(screen.queryByText(/doesn['’]t support mid-quest replies/i)).toBeNull();
  });

  it('shows an error message when respondInput rejects', async () => {
    mockRespondInput.mockRejectedValue(new Error('boom'));
    renderDock();
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox'), 'hello');
    await user.click(screen.getByRole('button', { name: /send message/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('boom');
    });
  });
});
