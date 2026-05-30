import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Project } from '@code-quests/shared';
import { CreateProjectSchema } from '@code-quests/shared';
import { api, ApiError } from '../../lib/api';
import { useFocusTrap } from '../../lib/use-focus-trap';
import { useActiveProjectStore } from '../../stores/active-project-store';
import { useProjects, PROJECTS_QUERY_KEY } from './use-projects';

interface ProjectPickerModalProps {
  onClose: () => void;
}

export default function ProjectPickerModal({ onClose }: ProjectPickerModalProps) {
  const panelRef = useFocusTrap(onClose);
  const closeRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();

  const activeProjectId = useActiveProjectStore((s) => s.activeProjectId);
  const setActiveProjectId = useActiveProjectStore((s) => s.setActiveProjectId);

  const { data, isLoading, error } = useProjects();
  const projects: Project[] = data ?? [];

  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [pathError, setPathError] = useState<string | null>(null);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState(false);

  async function handleBrowse() {
    setBrowseError(null);
    setBrowsing(true);
    try {
      const picked = await api.fs.pickFolder(path || undefined);
      if (picked) {
        setPath(picked);
        setPathError(null);
        // Auto-fill the name from the folder's basename if empty.
        if (!name.trim()) {
          const basename = picked.split('/').filter(Boolean).pop() ?? '';
          if (basename) setName(basename);
        }
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Folder picker failed';
      setBrowseError(msg);
    } finally {
      setBrowsing(false);
    }
  }

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const createMutation = useMutation({
    mutationFn: api.projects.create,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
      setActiveProjectId(created.id);
      setName('');
      setPath('');
      setNameError(null);
      setPathError(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.projects.delete(id),
    onSuccess: (_void, deletedId) => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
      if (activeProjectId === deletedId) {
        setActiveProjectId(null);
      }
    },
  });

  function handleSelect(id: string) {
    setActiveProjectId(id);
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNameError(null);
    setPathError(null);
    const parsed = CreateProjectSchema.safeParse({ name, path });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === 'name') setNameError(issue.message);
        if (key === 'path') setPathError(issue.message);
      }
      return;
    }
    createMutation.mutate(parsed.data);
  }

  const createServerError = (() => {
    if (!createMutation.error) return null;
    if (createMutation.error instanceof ApiError) {
      // 400 with field → render as inline field error
      if (createMutation.error.field === 'name' || createMutation.error.field === 'path') {
        return null;
      }
      return createMutation.error.message;
    }
    return createMutation.error instanceof Error
      ? createMutation.error.message
      : 'Failed to add project.';
  })();

  const createFieldError = (() => {
    if (createMutation.error instanceof ApiError) {
      if (createMutation.error.field === 'name') return { field: 'name' as const, message: createMutation.error.message };
      if (createMutation.error.field === 'path') return { field: 'path' as const, message: createMutation.error.message };
    }
    return null;
  })();

  const nameFieldError = nameError ?? (createFieldError?.field === 'name' ? createFieldError.message : null);
  const pathFieldError = pathError ?? (createFieldError?.field === 'path' ? createFieldError.message : null);

  const isCreating = createMutation.isPending;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-picker-title"
    >
      <div ref={panelRef} className="modal-panel" style={{ maxWidth: 560 }} data-testid="project-picker-modal">
        <h2 id="project-picker-title" className="modal-title">
          Choose a Project
        </h2>
        <p className="modal-body">
          Pick the project your agents will work in. The folder you choose becomes the working directory for every quest you dispatch.
        </p>

        <section aria-labelledby="project-list-heading" style={{ marginBottom: 18 }}>
          <h3 id="project-list-heading" style={{ color: '#7a1818', marginBottom: 6, fontSize: '1rem' }}>
            Your projects
          </h3>
          {isLoading && <p aria-live="polite">Loading projects…</p>}
          {error && (
            <p role="alert" className="recruit-error">
              Could not load projects. Make sure the server is running.
            </p>
          )}
          {!isLoading && !error && projects.length === 0 && (
            <p style={{ color: '#5a3818' }}>
              No projects yet. Add one below to point your agents at a folder.
            </p>
          )}
          {projects.length > 0 && (
            <ul
              role="radiogroup"
              aria-label="Existing projects"
              style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              {projects.map((p) => {
                const isActive = p.id === activeProjectId;
                return (
                  <li
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      border: '1px solid #b5a07a',
                      borderRadius: 4,
                      background: isActive ? '#f5ecd6' : '#fff8e8',
                    }}
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => handleSelect(p.id)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 2,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 4,
                        color: '#3a2410',
                      }}
                      aria-label={`Select project ${p.name} at ${p.path}`}
                    >
                      <strong style={{ color: '#7a1818' }}>{p.name}</strong>
                      <span style={{ fontSize: '0.8rem', color: '#5a3818', wordBreak: 'break-all' }}>
                        {p.path}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => deleteMutation.mutate(p.id)}
                      disabled={deleteMutation.isPending}
                      aria-label={`Delete project ${p.name}`}
                    >
                      Delete
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {deleteMutation.error && (
            <p role="alert" className="recruit-error" style={{ marginTop: 6 }}>
              {deleteMutation.error instanceof Error ? deleteMutation.error.message : 'Failed to delete project.'}
            </p>
          )}
        </section>

        <section aria-labelledby="add-project-heading">
          <h3 id="add-project-heading" style={{ color: '#7a1818', marginBottom: 6, fontSize: '1rem' }}>
            Add a project
          </h3>
          {createServerError && (
            <p role="alert" className="recruit-error">
              {createServerError}
            </p>
          )}
          <form onSubmit={handleSubmit} noValidate aria-label="Add project form">
            <div className="form-field">
              <label htmlFor="project-name">Name</label>
              <input
                id="project-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => {
                  if (!name.trim()) return setNameError(null);
                  const r = CreateProjectSchema.shape.name.safeParse(name);
                  setNameError(r.success ? null : (r.error.issues[0]?.message ?? 'Invalid'));
                }}
                aria-describedby={nameFieldError ? 'project-name-error' : undefined}
                aria-invalid={nameFieldError ? 'true' : undefined}
                maxLength={100}
                placeholder="e.g. My Side Project"
                disabled={isCreating}
              />
              {nameFieldError && (
                <p id="project-name-error" className="field-error" role="alert">
                  {nameFieldError}
                </p>
              )}
            </div>
            <div className="form-field">
              <label htmlFor="project-path">Absolute path</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  id="project-path"
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  onBlur={() => {
                    if (!path.trim()) return setPathError(null);
                    const r = CreateProjectSchema.shape.path.safeParse(path);
                    setPathError(r.success ? null : (r.error.issues[0]?.message ?? 'Invalid'));
                  }}
                  aria-describedby={pathFieldError ? 'project-path-error' : undefined}
                  aria-invalid={pathFieldError ? 'true' : undefined}
                  maxLength={1024}
                  placeholder="/Users/you/Dev/my-project"
                  disabled={isCreating || browsing}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { void handleBrowse(); }}
                  disabled={isCreating || browsing}
                  data-testid="browse-folder-btn"
                  aria-label="Browse for folder"
                  title="Open the OS folder picker"
                >
                  {browsing ? 'Opening…' : 'Browse…'}
                </button>
              </div>
              {pathFieldError && (
                <p id="project-path-error" className="field-error" role="alert">
                  {pathFieldError}
                </p>
              )}
              {browseError && (
                <p className="field-error" role="alert">
                  {browseError}
                </p>
              )}
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={isCreating} aria-busy={isCreating ? 'true' : undefined}>
                {isCreating ? 'Adding…' : 'Add Project'}
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
