import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useFocusTrap } from '../../lib/use-focus-trap';
import { api, ApiError } from '../../lib/api';
import { useModels } from '../models/use-models';

export interface ProposedRefinements {
  title?: string;
  description?: string;
  acceptanceCriteria?: string[];
}

interface CouncilModalProps {
  draftQuest: {
    title?: string;
    description?: string;
    acceptanceCriteria?: string[];
  };
  defaultModelId?: string | null;
  onClose: () => void;
  // Called when the user accepts a Council proposal. The parent updates
  // the draft form state with whichever fields the proposal includes.
  onApplyRefinements?: (refinements: ProposedRefinements) => void;
}

interface CouncilMessage {
  role: 'user' | 'assistant';
  content: string;
  // Structured proposal attached to assistant messages when Council
  // suggests concrete changes. Surfaced as an Apply button beneath the
  // bubble.
  proposal?: ProposedRefinements;
}

// Council = a pre-dispatch chat with a cheap model that helps refine the
// quest spec. Council emits a structured [[PROPOSAL]] JSON block per turn;
// the user can one-click apply those refinements to the draft form.

export default function CouncilModal({
  draftQuest,
  defaultModelId,
  onClose,
  onApplyRefinements,
}: CouncilModalProps) {
  const panelRef = useFocusTrap(onClose);
  const { data: models, isLoading: modelsLoading } = useModels();
  const [councilModelId, setCouncilModelId] = useState<string>(defaultModelId ?? '');
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<CouncilMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const lastReplyRef = useRef<HTMLParagraphElement>(null);

  // Auto-pick a sensible default council model: prefer ollama (free local,
  // fast) → openrouter (cheap pay-per-token) → claude_cli (works fine, just
  // slower since it's typically Sonnet/Opus).
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

  // Any registered model can serve as Council. We surface a hint when the
  // user picks claude_cli that it'll be slower, but we don't block — your
  // models, your call.
  const eligibleModels = models ?? [];
  const pickedModel = eligibleModels.find((m) => m.id === councilModelId);
  const showCliLatencyHint = pickedModel?.provider === 'claude_cli';

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
        {
          role: 'assistant',
          content: data.reply,
          ...(data.proposedRefinements ? { proposal: data.proposedRefinements } : {}),
        },
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
              No models registered. Add one in Settings → Models.
            </p>
          ) : (
            <>
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
              {showCliLatencyHint && (
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: '0.8rem',
                    color: '#7a4a18',
                    fontStyle: 'italic',
                  }}
                >
                  Heads up: claude_cli responses can take 30s+ per turn. If
                  you want snappier council back-and-forth, register an Ollama
                  or OpenRouter model and pick that instead.
                </p>
              )}
            </>
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
            <div
              key={idx}
              ref={idx === history.length - 1 ? lastReplyRef : null}
              style={{ margin: '8px 0' }}
            >
              <div
                style={{
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
              </div>
              {m.proposal && onApplyRefinements && (
                <ProposalPreview
                  proposal={m.proposal}
                  draftQuest={draftQuest}
                  onApply={() => {
                    onApplyRefinements(m.proposal!);
                  }}
                />
              )}
            </div>
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

function ProposalPreview({
  proposal,
  draftQuest,
  onApply,
}: {
  proposal: ProposedRefinements;
  draftQuest: {
    title?: string;
    description?: string;
    acceptanceCriteria?: string[];
  };
  onApply: () => void;
}) {
  const [applied, setApplied] = useState(false);

  // Compute which fields actually differ from the current draft so we don't
  // surface "Apply" for no-op proposals.
  const changes: Array<{ field: string; before: string; after: string }> = [];
  if (proposal.title !== undefined && proposal.title !== (draftQuest.title ?? '')) {
    changes.push({
      field: 'Title',
      before: draftQuest.title ?? '(empty)',
      after: proposal.title,
    });
  }
  if (
    proposal.description !== undefined &&
    proposal.description !== (draftQuest.description ?? '')
  ) {
    changes.push({
      field: 'Description',
      before: draftQuest.description ?? '(empty)',
      after: proposal.description,
    });
  }
  if (proposal.acceptanceCriteria !== undefined) {
    const beforeStr = (draftQuest.acceptanceCriteria ?? []).join('\n• ');
    const afterStr = proposal.acceptanceCriteria.join('\n• ');
    if (beforeStr !== afterStr) {
      changes.push({
        field: 'Conditions of victory',
        before: beforeStr ? `• ${beforeStr}` : '(none)',
        after: `• ${afterStr}`,
      });
    }
  }

  if (changes.length === 0) return null;

  return (
    <div
      data-testid="council-proposal"
      style={{
        marginTop: 6,
        padding: '8px 10px',
        background: '#f0e6c8',
        border: '1px solid #b5a07a',
        borderLeft: '3px solid #5a8a3a',
        borderRadius: 4,
        fontSize: '0.85rem',
        color: '#2a1404',
      }}
    >
      <strong style={{ display: 'block', marginBottom: 4, color: '#3a5a1a' }}>
        Proposed scroll — {changes.length} change{changes.length === 1 ? '' : 's'}
      </strong>
      <ul style={{ margin: '0 0 8px 16px', padding: 0 }}>
        {changes.map((c) => (
          <li key={c.field} style={{ marginBottom: 4 }}>
            <em>{c.field}:</em>{' '}
            <span style={{ color: '#7a1818', textDecoration: 'line-through' }}>
              {c.before.length > 80 ? `${c.before.slice(0, 80)}…` : c.before}
            </span>{' '}
            <span aria-hidden="true">→</span>{' '}
            <span style={{ color: '#3a5a1a', whiteSpace: 'pre-wrap' }}>
              {c.after.length > 200 ? `${c.after.slice(0, 200)}…` : c.after}
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn-primary"
        style={{ padding: '4px 10px', fontSize: '0.85rem' }}
        disabled={applied}
        data-testid="apply-proposal-btn"
        onClick={() => {
          onApply();
          setApplied(true);
        }}
      >
        {applied ? '✓ Applied to scroll' : 'Apply to scroll'}
      </button>
    </div>
  );
}
