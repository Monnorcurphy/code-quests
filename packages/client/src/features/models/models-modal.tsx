import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ModelProvider, CreateModelInput } from '@code-quests/shared';
import { providerNeedsKey } from '@code-quests/shared';
import { api, ApiError, type ReturnedModel } from '../../lib/api';
import { useFocusTrap } from '../../lib/use-focus-trap';
import { useModels, MODELS_QUERY_KEY } from './use-models';

// Three states for the model row badge:
//   ✓ key            — provider needs a key AND one is stored
//   needs key        — provider needs a key AND none is stored
//   uses subscription — provider doesn't need a key (claude_cli)
//   no key required  — provider doesn't need a key (ollama)
function badgeFor(m: ReturnedModel): { label: string; bg: string } {
  if (!providerNeedsKey(m.provider)) {
    return m.provider === 'claude_cli'
      ? { label: 'uses subscription', bg: '#4a4830' }
      : { label: 'no key required', bg: '#4a4830' };
  }
  return m.hasKey
    ? { label: '✓ key', bg: '#2f6b2f' }
    : { label: 'needs key', bg: '#7a4818' };
}

interface ModelsModalProps {
  onClose: () => void;
}

// Only these three providers are wired into v1. anthropic_api / openai are
// reserved for later phases and intentionally not exposed in the UI.
type SupportedProvider = Extract<ModelProvider, 'claude_cli' | 'openrouter' | 'ollama'>;

interface ProviderOption {
  value: SupportedProvider;
  label: string;
  placeholder: string;
  needsKey: boolean;
  hint: string;
  setupHint?: string;
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    value: 'claude_cli',
    label: 'Claude (CLI)',
    placeholder: 'sonnet',
    needsKey: false,
    hint: 'Uses your Claude CLI subscription — no API key. Try sonnet, opus, haiku, or a full id like claude-sonnet-4-6.',
    setupHint: 'Requires the `claude` binary on your PATH (https://claude.com/claude-code).',
  },
  {
    value: 'openrouter',
    label: 'OpenRouter',
    placeholder: 'anthropic/claude-3.5-sonnet',
    needsKey: true,
    hint: 'Pay-per-token gateway to hundreds of models. Browse openrouter.ai/models for ids: anthropic/claude-3.5-sonnet, google/gemini-flash-1.5, meta-llama/llama-3.3-70b-instruct, deepseek/deepseek-chat, etc.',
    setupHint: 'Get a key at openrouter.ai/keys, then paste it below.',
  },
  {
    value: 'ollama',
    label: 'Ollama',
    placeholder: 'llama3.1:8b',
    needsKey: false,
    hint: 'Runs models locally — free, private, no key. Use whatever you have pulled. Run `ollama list` in a terminal to see your installed models.',
    setupHint: 'Install Ollama from ollama.com, then `ollama pull llama3.1:8b` (or any model you want).',
  },
];

function providerOption(p: SupportedProvider) {
  // PROVIDER_OPTIONS is a small static array — find is fine and keeps the
  // mapping declarative.
  const found = PROVIDER_OPTIONS.find((o) => o.value === p);
  if (!found) throw new Error(`unknown provider ${p}`);
  return found;
}

export default function ModelsModal({ onClose }: ModelsModalProps) {
  const panelRef = useFocusTrap(onClose);
  const closeRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useModels();
  const models: ReturnedModel[] = data ?? [];

  const [provider, setProvider] = useState<SupportedProvider>('claude_cli');
  const [name, setName] = useState('');
  const [modelIdValue, setModelIdValue] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const createMutation = useMutation({
    mutationFn: (input: CreateModelInput) => api.models.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MODELS_QUERY_KEY });
      setName('');
      setModelIdValue('');
      setApiKey('');
      setBaseUrl('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.models.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MODELS_QUERY_KEY });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const option = providerOption(provider);
    const config: Record<string, string> = {};
    if (provider === 'ollama' && baseUrl.trim()) {
      config.baseUrl = baseUrl.trim();
    }
    const input: CreateModelInput = {
      name: name.trim(),
      provider,
      modelId: modelIdValue.trim(),
      config,
      ...(option.needsKey && apiKey ? { apiKey } : {}),
    };
    createMutation.mutate(input);
  }

  function fieldError(field: string): string | null {
    if (createMutation.error instanceof ApiError && createMutation.error.field === field) {
      return createMutation.error.message;
    }
    return null;
  }

  const generalCreateError = (() => {
    if (!createMutation.error) return null;
    if (createMutation.error instanceof ApiError && createMutation.error.field) {
      // field-level errors render inline; skip the banner
      return null;
    }
    return createMutation.error instanceof Error
      ? createMutation.error.message
      : 'Failed to add model.';
  })();

  const option = providerOption(provider);
  const showApiKeyField = option.needsKey;
  const isCreating = createMutation.isPending;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="models-title"
    >
      <div ref={panelRef} className="modal-panel" style={{ maxWidth: 560 }} data-testid="models-modal">
        <h2 id="models-title" className="modal-title">Models</h2>
        <p className="modal-body">
          Models are the LLMs your adventurers think with. Register one per provider you want
          to use — your Claude CLI subscription, an OpenRouter account, a local Ollama install,
          or any combination. You'll pick from this list when drafting a quest. API keys live
          in your OS keychain, never the database.
        </p>

        <section aria-labelledby="models-list-heading" style={{ marginBottom: 18 }}>
          <h3 id="models-list-heading" style={{ color: '#7a1818', marginBottom: 6, fontSize: '1rem' }}>
            Your models
          </h3>
          {isLoading && <p aria-live="polite">Loading models…</p>}
          {error && (
            <p role="alert" className="recruit-error">
              Could not load models. Make sure the server is running.
            </p>
          )}
          {!isLoading && !error && models.length === 0 && (
            <p style={{ color: '#5a3818' }}>
              No models yet — add one to get started.
            </p>
          )}
          {models.length > 0 && (
            <ul
              aria-label="Existing models"
              style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              {models.map((m) => (
                <li
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    border: '1px solid #b5a07a',
                    borderRadius: 4,
                    background: '#fff8e8',
                  }}
                >
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, color: '#3a2410' }}>
                    <strong style={{ color: '#7a1818' }}>{m.name}</strong>
                    <span style={{ fontSize: '0.8rem', color: '#5a3818', wordBreak: 'break-all' }}>
                      {m.provider} · {m.modelId}
                    </span>
                  </div>
                  {(() => {
                    const b = badgeFor(m);
                    return (
                      <span
                        aria-label={b.label}
                        style={{
                          fontSize: '0.75rem',
                          padding: '2px 6px',
                          borderRadius: 3,
                          background: b.bg,
                          color: '#fff8e8',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {b.label}
                      </span>
                    );
                  })()}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => deleteMutation.mutate(m.id)}
                    disabled={deleteMutation.isPending}
                    aria-label={`Delete model ${m.name}`}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
          {deleteMutation.error && (
            <p role="alert" className="recruit-error" style={{ marginTop: 6 }}>
              {deleteMutation.error instanceof Error ? deleteMutation.error.message : 'Failed to delete model.'}
            </p>
          )}
        </section>

        <section aria-labelledby="add-model-heading">
          <h3 id="add-model-heading" style={{ color: '#7a1818', marginBottom: 6, fontSize: '1rem' }}>
            Add a model
          </h3>
          {generalCreateError && (
            <p role="alert" className="recruit-error">
              {generalCreateError}
            </p>
          )}
          <form onSubmit={handleSubmit} noValidate aria-label="Add model form">
            <fieldset className="form-field" style={{ border: 'none', padding: 0, margin: '0 0 12px 0' }}>
              <legend style={{ color: '#3a2410', marginBottom: 4 }}>Provider</legend>
              <div role="radiogroup" aria-label="Provider" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {PROVIDER_OPTIONS.map((opt) => (
                  <label key={opt.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#3a2410' }}>
                    <input
                      type="radio"
                      name="model-provider"
                      value={opt.value}
                      checked={provider === opt.value}
                      onChange={() => setProvider(opt.value)}
                      disabled={isCreating}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="form-field">
              <label htmlFor="model-name">Display name</label>
              <input
                id="model-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-describedby={fieldError('name') ? 'model-name-error' : undefined}
                aria-invalid={fieldError('name') ? 'true' : undefined}
                maxLength={80}
                placeholder="e.g. Claude Sonnet"
                disabled={isCreating}
              />
              {fieldError('name') && (
                <p id="model-name-error" className="field-error" role="alert">
                  {fieldError('name')}
                </p>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="model-identifier">Model identifier</label>
              <input
                id="model-identifier"
                type="text"
                value={modelIdValue}
                onChange={(e) => setModelIdValue(e.target.value)}
                aria-describedby={
                  fieldError('modelId') ? 'model-identifier-error' : 'model-identifier-hint'
                }
                aria-invalid={fieldError('modelId') ? 'true' : undefined}
                maxLength={200}
                placeholder={option.placeholder}
                disabled={isCreating}
              />
              <p
                id="model-identifier-hint"
                style={{
                  margin: '4px 0 0',
                  fontSize: '0.8rem',
                  color: '#5a3818',
                  lineHeight: 1.35,
                }}
              >
                {option.hint}
              </p>
              {option.setupHint && (
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: '0.75rem',
                    color: '#7a4a18',
                    fontStyle: 'italic',
                  }}
                >
                  Setup: {option.setupHint}
                </p>
              )}
              {fieldError('modelId') && (
                <p id="model-identifier-error" className="field-error" role="alert">
                  {fieldError('modelId')}
                </p>
              )}
            </div>

            {showApiKeyField && (
              <div className="form-field">
                <label htmlFor="model-api-key">API key</label>
                <input
                  id="model-api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  aria-describedby={fieldError('apiKey') ? 'model-api-key-error' : undefined}
                  aria-invalid={fieldError('apiKey') ? 'true' : undefined}
                  maxLength={500}
                  placeholder="sk-or-…"
                  autoComplete="off"
                  disabled={isCreating}
                />
                {fieldError('apiKey') && (
                  <p id="model-api-key-error" className="field-error" role="alert">
                    {fieldError('apiKey')}
                  </p>
                )}
              </div>
            )}

            {provider === 'ollama' && (
              <div className="form-field">
                <label htmlFor="model-base-url">Base URL (optional)</label>
                <input
                  id="model-base-url"
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  disabled={isCreating}
                />
              </div>
            )}

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={isCreating} aria-busy={isCreating ? 'true' : undefined}>
                {isCreating ? 'Adding…' : 'Add Model'}
              </button>
              <button
                ref={closeRef}
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={isCreating}
              >
                Close
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
