import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useFocusTrap } from '../../lib/use-focus-trap';
import { api, ApiError } from '../../lib/api';
import { useModels } from '../models/use-models';

interface CouncilModalProps {
  draftQuest: {
    title?: string;
    description?: string;
    acceptanceCriteria?: string[];
  };
  defaultModelId?: string | null;
  onClose: () => void;
}

interface CouncilMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Council = a pre-dispatch chat with a cheap model that helps refine the
// quest spec. Does not auto-apply changes to the form — the user reads the
// suggestions and edits the draft themselves. Optimised for "ask sharp
// questions, suggest concrete improvements" rather than open-ended chat.

export default function CouncilModal({
  draftQuest,
  defaultModelId,
  onClose,
}: CouncilModalProps) {
  const panelRef = useFocusTrap(onClose);
  const { data: models, isLoading: modelsLoading } = useModels();
  const [councilModelId, setCouncilModelId] = useState<string>(defaultModelId ?? '');
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<CouncilMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const lastReplyRef = useRef<HTMLParagraphElement>(null);

  // Auto-pick a sensible default council model: prefer ollama (free local)
  // → openrouter (probably cheap) → first available. Skip claude_cli.
  useEffect(() => {
    if (councilModelId || !models || models.length === 0) return;
    const ollama = models.find((m) => m.provider === 'ollama');
    if (ollama) {
      setCouncilModelId(ollama.id);
      return;
    }
    const or = models.find((m) => m.provider === 'openrouter');
    if (or) {
      setCouncilModelId(or.id);
      return;
    }
    setCouncilModelId(models[0]!.id);
  }, [councilModelId, models]);

  const eligibleModels = (models ?? []).filter((m) => m.provider !== 'claude_cli');

  const mutation = useMutation({
    mutationFn: (text: string) =>
      api.council.consult({
        modelId: councilModelId,
        draftQuest,
        history,
        userMessage: text,
      }),
    onSuccess: (data, text) => {
      setHistory((prev) => [
        ...prev,
        { role: 'user', content: text },
        { role: 'assistant', content: data.reply },
      ]);
      setError(null);
      setInput('');
      // Scroll the new reply into view — guarded so the timer firing after
      // unmount during fast user actions doesn't surface a "scrollIntoView
      // is not a function" jsdom error.
      setTimeout(() => {
        if (lastReplyRef.current && typeof lastReplyRef.current.scrollIntoView === 'function') {
          lastReplyRef.current.scrollIntoView({ block: 'end', behavior: 'smooth' });
        }
      }, 50);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Council consultation failed. Try again.');
      }
    },
  });

  function handleSend() {
    const text = input.trim();
    if (!text || !councilModelId || mutation.isPending) return;
    mutation.mutate(text);
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="council-title"
      style={{ zIndex: 250 }}
    >
      <div ref={panelRef} className="modal-panel council-panel">
        <h2 id="council-title" className="modal-title">
          Convene the Council
        </h2>
        <p className="modal-body" style={{ color: '#5a3818' }}>
          A cheap, fast model reads your draft, asks clarifying questions, and
          suggests refinements. Stop when the spec feels precise — then close
          and dispatch.
        </p>

        <div className="form-field">
          <label htmlFor="council-model">Council model</label>
          {modelsLoading ? (
            <p style={{ color: '#5a3818' }}>Loading…</p>
          ) : eligibleModels.length === 0 ? (
            <p style={{ color: '#7a1818' }}>
              No model available for council. Add an OpenRouter or Ollama model
              in Settings → Models.
            </p>
          ) : (
            <select
              id="council-model"
              value={councilModelId}
              onChange={(e) => setCouncilModelId(e.target.value)}
              data-testid="council-model-select"
            >
              {eligibleModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.provider} · {m.modelId}
                </option>
              ))}
            </select>
          )}
        </div>

        <div
          ref={transcriptRef}
          className="council-transcript"
          data-testid="council-transcript"
          style={{
            border: '1px solid #b5a07a',
            borderRadius: 4,
            background: '#fbe6c4',
            color: '#2a1404',
            padding: 12,
            minHeight: 200,
            maxHeight: 360,
            overflowY: 'auto',
            margin: '8px 0',
          }}
        >
          {history.length === 0 && !mutation.isPending && (
            <p style={{ color: '#5a3818', fontStyle: 'italic' }}>
              The Council awaits your first question. Try: "Is this title
              precise enough?" or "What edge cases am I missing?"
            </p>
          )}
          {history.map((m, idx) => (
            <p
              key={idx}
              ref={idx === history.length - 1 ? lastReplyRef : null}
              style={{
                margin: '8px 0',
                padding: '6px 10px',
                borderRadius: 4,
                background: m.role === 'user' ? '#f5ecd6' : '#fff8e7',
                borderLeft: `3px solid ${m.role === 'user' ? '#7a4a18' : '#5a3818'}`,
              }}
            >
              <strong style={{ display: 'block', fontSize: '0.85rem', color: '#5a3818' }}>
                {m.role === 'user' ? 'You' : 'The Council'}
              </strong>
              <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
            </p>
          ))}
          {mutation.isPending && (
            <p style={{ color: '#5a3818', fontStyle: 'italic' }} aria-live="polite">
              The Council deliberates…
            </p>
          )}
        </div>

        {error && (
          <p role="alert" style={{ color: '#7a1818', margin: '0 0 8px' }}>
            {error}
          </p>
        )}

        <div className="form-field">
          <label htmlFor="council-input" className="sr-only">
            Your message
          </label>
          <textarea
            id="council-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask the Council a question, or describe what you're unsure about. Ctrl/Cmd+Enter to send."
            rows={3}
            className="form-textarea"
            disabled={
              mutation.isPending || !councilModelId || eligibleModels.length === 0
            }
            maxLength={8000}
            data-testid="council-input"
          />
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleSend}
            disabled={
              !input.trim() ||
              mutation.isPending ||
              !councilModelId ||
              eligibleModels.length === 0
            }
          >
            {mutation.isPending ? 'Asking…' : 'Send to Council'}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Done with Council
          </button>
        </div>
      </div>
    </div>
  );
}
