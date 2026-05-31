import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useFocusTrap } from '../../lib/use-focus-trap';
import { api, ApiError } from '../../lib/api';
import { useModels } from '../models/use-models';

// All advisors share this shape — fields outside the advisor's allowed
// proposalFields will simply never be present on the server response.
export interface ProposedRefinements {
  title?: string;
  description?: string;
  acceptanceCriteria?: string[];
  edgeCases?: string[];
  context?: string;
  skillCandidates?: Array<{ name: string; description: string }>;
  equipment?: { skillIds?: string[]; toolIds?: string[]; mcpServerIds?: string[] };
}

export type AdvisorKind = 'council' | 'oracle' | 'tavern' | 'library' | 'armory';

interface AdvisorMessage {
  role: 'user' | 'assistant';
  content: string;
  proposal?: ProposedRefinements;
}

export interface AdvisorModalProps {
  kind: AdvisorKind;
  npcName: string;
  npcRole: string;
  // The intro line shown above the model picker. Keep it short — one
  // sentence in the room's voice.
  intro: string;
  // What the advisor can see from the current draft.
  draftQuest: {
    title?: string;
    description?: string;
    acceptanceCriteria?: string[];
    edgeCases?: string[];
    context?: string;
  };
  // Optional Armory catalogue (skill / tool / mcp ids the smith can pick from).
  catalogue?: {
    skills?: Array<{ id: string; name: string }>;
    tools?: Array<{ id: string; name: string }>;
    mcpServers?: Array<{ id: string; name: string }>;
  };
  defaultModelId?: string | null;
  // Placeholder text inside the input. Defaults to a generic prompt.
  inputPlaceholder?: string;
  // Suggestion sentence shown in the empty transcript ("Try: 'X?'").
  starterPrompt?: string;
  onClose: () => void;
  onApplyRefinements?: (refinements: ProposedRefinements) => void;
}

const KIND_LABEL: Record<AdvisorKind, string> = {
  council: 'Council',
  oracle: 'Oracle',
  tavern: 'Tavern',
  library: 'Library',
  armory: 'Armory',
};

// Tone-flavoured strings per advisor. Keeps the modal in-character without
// having to thread every label through props.
const STRINGS: Record<AdvisorKind, { sendLabel: string; thinking: string; bubbleLabel: string }> = {
  council: { sendLabel: 'Send to Council', thinking: 'The Council deliberates…', bubbleLabel: 'The Council' },
  oracle: { sendLabel: 'Consult the Oracle', thinking: 'Seer Caelis gazes into the future…', bubbleLabel: 'Seer Caelis' },
  tavern: { sendLabel: 'Ask Rorek', thinking: 'Rorek pours another and thinks…', bubbleLabel: 'Innkeep Rorek' },
  library: { sendLabel: 'Consult the Sage', thinking: 'Sage Mireldine turns a page…', bubbleLabel: 'Sage Mireldine' },
  armory: { sendLabel: 'Ask the Smith', thinking: 'Smith eyes the workbench…', bubbleLabel: 'Smith' },
};

export default function AdvisorModal({
  kind,
  npcName,
  npcRole,
  intro,
  draftQuest,
  catalogue,
  defaultModelId,
  inputPlaceholder,
  starterPrompt,
  onClose,
  onApplyRefinements,
}: AdvisorModalProps) {
  const panelRef = useFocusTrap(onClose);
  const { data: models, isLoading: modelsLoading } = useModels();
  const [advisorModelId, setAdvisorModelId] = useState<string>(defaultModelId ?? '');
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<AdvisorMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const lastReplyRef = useRef<HTMLDivElement>(null);
  const strings = STRINGS[kind];

  // Auto-pick: prefer ollama (free local) → openrouter → anything.
  useEffect(() => {
    if (advisorModelId || !models || models.length === 0) return;
    const ollama = models.find((m) => m.provider === 'ollama');
    if (ollama) { setAdvisorModelId(ollama.id); return; }
    const or = models.find((m) => m.provider === 'openrouter');
    if (or) { setAdvisorModelId(or.id); return; }
    setAdvisorModelId(models[0]!.id);
  }, [advisorModelId, models]);

  const eligibleModels = models ?? [];
  const pickedModel = eligibleModels.find((m) => m.id === advisorModelId);
  const showCliLatencyHint = pickedModel?.provider === 'claude_cli';

  const mutation = useMutation({
    mutationFn: (text: string) =>
      api.advisors.consult(kind, {
        modelId: advisorModelId,
        draftQuest,
        history,
        userMessage: text,
        ...(catalogue ? { catalogue } : {}),
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
      setTimeout(() => {
        if (lastReplyRef.current && typeof lastReplyRef.current.scrollIntoView === 'function') {
          lastReplyRef.current.scrollIntoView({ block: 'end', behavior: 'smooth' });
        }
      }, 50);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : `${npcName} couldn't be reached.`);
    },
  });

  function handleSend() {
    const text = input.trim();
    if (!text || !advisorModelId || mutation.isPending) return;
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
      aria-labelledby="advisor-title"
      style={{ zIndex: 250 }}
    >
      <div ref={panelRef} className="modal-panel advisor-panel" data-testid={`advisor-modal-${kind}`}>
        <h2 id="advisor-title" className="modal-title">
          Consult {npcName}
        </h2>
        <p className="modal-body" style={{ color: '#5a3818' }}>
          <strong>{npcRole}.</strong> {intro}
        </p>

        <div className="form-field">
          <label htmlFor={`advisor-model-${kind}`}>{KIND_LABEL[kind]} model</label>
          {modelsLoading ? (
            <p style={{ color: '#5a3818' }}>Loading…</p>
          ) : eligibleModels.length === 0 ? (
            <p style={{ color: '#7a1818' }}>
              No models registered. Add one in Settings → Models.
            </p>
          ) : (
            <>
              <select
                id={`advisor-model-${kind}`}
                value={advisorModelId}
                onChange={(e) => setAdvisorModelId(e.target.value)}
                data-testid="advisor-model-select"
              >
                {eligibleModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.provider} · {m.modelId}
                  </option>
                ))}
              </select>
              {showCliLatencyHint && (
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#7a4a18', fontStyle: 'italic' }}>
                  Heads up: claude_cli responses can take 30s+ per turn. Register an Ollama or
                  OpenRouter model for snappier back-and-forth.
                </p>
              )}
            </>
          )}
        </div>

        <div
          className="advisor-transcript"
          data-testid="advisor-transcript"
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
              {starterPrompt ?? `Ask ${npcName} a question to begin.`}
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
                  {m.role === 'user' ? 'You' : strings.bubbleLabel}
                </strong>
                <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
              </div>
              {m.proposal && onApplyRefinements && (
                <ProposalPreview
                  proposal={m.proposal}
                  draftQuest={draftQuest}
                  onApply={() => onApplyRefinements(m.proposal!)}
                />
              )}
            </div>
          ))}
          {mutation.isPending && (
            <p style={{ color: '#5a3818', fontStyle: 'italic' }} aria-live="polite">
              {strings.thinking}
            </p>
          )}
        </div>

        {error && (
          <p role="alert" style={{ color: '#7a1818', margin: '0 0 8px' }}>
            {error}
          </p>
        )}

        <div className="form-field">
          <label htmlFor={`advisor-input-${kind}`} className="sr-only">Your message</label>
          <textarea
            id={`advisor-input-${kind}`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={inputPlaceholder ?? `Ask ${npcName} — Ctrl/Cmd+Enter to send.`}
            rows={3}
            className="form-textarea"
            disabled={mutation.isPending || !advisorModelId || eligibleModels.length === 0}
            maxLength={8000}
            data-testid="advisor-input"
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
              !advisorModelId ||
              eligibleModels.length === 0
            }
          >
            {mutation.isPending ? 'Asking…' : strings.sendLabel}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
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
  draftQuest: AdvisorModalProps['draftQuest'];
  onApply: () => void;
}) {
  const [applied, setApplied] = useState(false);

  const changes: Array<{ field: string; before: string; after: string }> = [];
  if (proposal.title !== undefined && proposal.title !== (draftQuest.title ?? '')) {
    changes.push({ field: 'Title', before: draftQuest.title ?? '(empty)', after: proposal.title });
  }
  if (proposal.description !== undefined && proposal.description !== (draftQuest.description ?? '')) {
    changes.push({ field: 'Description', before: draftQuest.description ?? '(empty)', after: proposal.description });
  }
  if (proposal.context !== undefined && proposal.context !== (draftQuest.context ?? '')) {
    changes.push({ field: 'Context', before: draftQuest.context ?? '(empty)', after: proposal.context });
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
  if (proposal.edgeCases !== undefined) {
    const beforeStr = (draftQuest.edgeCases ?? []).join('\n• ');
    const afterStr = proposal.edgeCases.join('\n• ');
    if (beforeStr !== afterStr) {
      changes.push({
        field: 'Edge cases',
        before: beforeStr ? `• ${beforeStr}` : '(none)',
        after: `• ${afterStr}`,
      });
    }
  }
  if (proposal.skillCandidates !== undefined && proposal.skillCandidates.length > 0) {
    changes.push({
      field: 'Skill candidates',
      before: '(none proposed)',
      after: proposal.skillCandidates.map((s) => `${s.name} — ${s.description}`).join('\n'),
    });
  }
  if (proposal.equipment !== undefined) {
    const all: string[] = [];
    if (proposal.equipment.skillIds?.length) all.push(`skills: ${proposal.equipment.skillIds.join(', ')}`);
    if (proposal.equipment.toolIds?.length) all.push(`tools: ${proposal.equipment.toolIds.join(', ')}`);
    if (proposal.equipment.mcpServerIds?.length) all.push(`mcp: ${proposal.equipment.mcpServerIds.join(', ')}`);
    if (all.length > 0) {
      changes.push({ field: 'Loadout', before: '(unchanged)', after: all.join(' / ') });
    }
  }

  // No-op proposals are hidden — UNLESS the user has already applied this
  // proposal once. After Apply, the draft equals the proposal so changes
  // computes empty; we still want to render a small "applied" confirmation
  // chip so the user can see what they accepted.
  if (changes.length === 0 && !applied) return null;

  if (changes.length === 0 && applied) {
    return (
      <div
        data-testid="advisor-proposal"
        style={{
          marginTop: 6,
          padding: '6px 10px',
          background: '#e6e8d8',
          border: '1px solid #5a8a3a',
          borderRadius: 4,
          fontSize: '0.8rem',
          color: '#3a5a1a',
        }}
      >
        <button
          type="button"
          className="btn-primary"
          style={{ padding: '2px 8px', fontSize: '0.8rem' }}
          disabled
          data-testid="apply-proposal-btn"
        >
          ✓ Applied to scroll
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="advisor-proposal"
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
            → <span style={{ color: '#3a5a1a', whiteSpace: 'pre-wrap' }}>
              {c.after.length > 240 ? `${c.after.slice(0, 240)}…` : c.after}
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
