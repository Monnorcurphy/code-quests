import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useQuestStore } from '../../stores/quest-store';
import type { StoredEvent } from '../../stores/quest-store';
import { api, ApiError } from '../../lib/api';
import type { ModelProvider } from '@code-quests/shared';

const EMPTY_ENTRIES: StoredEvent[] = [];

interface ChatBubble {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

/**
 * Collapse the quest-store event stream into chat bubbles.
 *
 * The OpenRouter / Ollama adapters stream their accumulating-text reply as
 * many `progress` events — each one a strictly longer prefix of the final
 * text. To render this as a single growing bubble we group consecutive
 * assistant-progress events into one bubble that takes the LATEST event's
 * text. A [turn_ended] log event flushes the current bubble so the next
 * assistant turn starts a new one.
 *
 * User messages are emitted by the adapter when respond() is called and
 * appear as `progress` events with `role: 'user'`. Each is its own bubble.
 */
function collapseToBubbles(events: StoredEvent[]): ChatBubble[] {
  const bubbles: ChatBubble[] = [];
  let openAssistant: ChatBubble | null = null;

  for (const ev of events) {
    if (ev.type === 'log' && ev.message === '[turn_ended]') {
      openAssistant = null;
      continue;
    }
    if (ev.type !== 'progress') continue;

    const role: 'user' | 'assistant' = ev.role === 'user' ? 'user' : 'assistant';
    if (role === 'user') {
      bubbles.push({ id: ev._id, role: 'user', text: ev.message, timestamp: ev.timestamp });
      openAssistant = null;
      continue;
    }
    if (openAssistant) {
      // Replace the open bubble's text with the latest (longer) prefix.
      openAssistant.text = ev.message;
      openAssistant.timestamp = ev.timestamp;
    } else {
      const bubble: ChatBubble = { id: ev._id, role: 'assistant', text: ev.message, timestamp: ev.timestamp };
      bubbles.push(bubble);
      openAssistant = bubble;
    }
  }
  return bubbles;
}

/**
 * The quest is "streaming" (turn in flight) if the last progress event
 * has not yet been followed by a [turn_ended] log or a completed/failed
 * terminal event. We compute it from the live event stream so the UI
 * doesn't need extra store state.
 */
function computeTurnInFlight(events: StoredEvent[]): boolean {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const ev = events[i];
    if (ev.type === 'completed' || ev.type === 'failed') return false;
    if (ev.type === 'log' && ev.message === '[turn_ended]') return false;
    if (ev.type === 'progress' && (ev.role ?? 'assistant') === 'assistant') return true;
  }
  return false;
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return ts;
  }
}

interface ChatDockProps {
  questId: string;
  /** The quest's selected model id (Quest.modelId); used to resolve provider. */
  modelId: string | null;
}

const UNSUPPORTED_PROVIDERS = new Set<ModelProvider>(['claude_cli']);

function useProviderForQuest(modelId: string | null): ModelProvider | null {
  const { data } = useQuery({
    queryKey: ['models'],
    queryFn: () => api.models.list(),
  });
  return useMemo(() => {
    if (!modelId || !data) return null;
    const match = data.find((m) => m.id === modelId);
    return match?.provider ?? null;
  }, [modelId, data]);
}

export default function ChatDock({ questId, modelId }: ChatDockProps) {
  const entries = useQuestStore((s) => s.entriesByQuest[questId] ?? EMPTY_ENTRIES);
  const bubbles = useMemo(() => collapseToBubbles(entries), [entries]);
  const turnInFlight = useMemo(() => computeTurnInFlight(entries), [entries]);

  const provider = useProviderForQuest(modelId);
  const unsupported = provider !== null && UNSUPPORTED_PROVIDERS.has(provider);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || userScrolledRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [bubbles.length, bubbles[bubbles.length - 1]?.text]);

  function handleScroll(): void {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 12;
    userScrolledRef.current = !atBottom;
  }

  const sendDisabled = sending || turnInFlight || text.trim().length === 0;

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.quests.respondInput(questId, trimmed);
      setText('');
      userScrolledRef.current = false;
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to send message';
      setError(msg);
    } finally {
      setSending(false);
    }
  }, [text, sending, questId]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  if (collapsed) {
    return (
      <div className="chat-dock chat-dock--collapsed">
        <button
          type="button"
          className="chat-dock__toggle"
          onClick={() => setCollapsed(false)}
          aria-label="Expand chat dock"
          aria-expanded={false}
        >
          Chat
        </button>
      </div>
    );
  }

  return (
    <aside
      className="chat-dock"
      aria-label="Adventurer chat"
    >
      <header className="chat-dock__header">
        <h2 className="chat-dock__title">Talk to the Adventurer</h2>
        <button
          type="button"
          className="chat-dock__toggle"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse chat dock"
          aria-expanded={true}
        >
          —
        </button>
      </header>

      {unsupported && (
        <div role="status" className="chat-dock__banner">
          This adapter doesn&apos;t support mid-quest replies yet — your message
          will be saved for the next turn but the agent may not see it until a
          new dispatch.
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="chat-dock__messages"
        role="log"
        aria-label="Chat conversation"
        aria-live="polite"
        aria-atomic="false"
      >
        {bubbles.length === 0 ? (
          <p className="chat-dock__empty">
            No messages yet. The adventurer&apos;s replies will appear here.
          </p>
        ) : (
          bubbles.map((b) => (
            <div
              key={b.id}
              className={`chat-bubble chat-bubble--${b.role}`}
              data-author={b.role === 'user' ? 'You' : 'Adventurer'}
            >
              <span className="chat-bubble__author">
                {b.role === 'user' ? 'You' : 'Adventurer'}
                <span className="chat-bubble__ts">{formatTimestamp(b.timestamp)}</span>
              </span>
              <p className="chat-bubble__text">{b.text}</p>
            </div>
          ))
        )}
      </div>

      <form
        className="chat-dock__form"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend();
        }}
      >
        <label htmlFor={`chat-dock-input-${questId}`} className="sr-only">
          Message the adventurer
        </label>
        <textarea
          id={`chat-dock-input-${questId}`}
          className="chat-dock__textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            turnInFlight
              ? 'Adventurer is replying… (you can still type)'
              : 'Type a message and press Enter'
          }
          rows={2}
          aria-describedby={error ? `chat-dock-error-${questId}` : undefined}
        />
        <button
          type="submit"
          className="chat-dock__send"
          disabled={sendDisabled}
          aria-label="Send message"
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>
      {turnInFlight && (
        <p className="chat-dock__status" role="status" aria-live="polite">
          Adventurer is responding…
        </p>
      )}
      {error && (
        <p
          id={`chat-dock-error-${questId}`}
          className="chat-dock__error"
          role="alert"
        >
          {error}
        </p>
      )}
    </aside>
  );
}
