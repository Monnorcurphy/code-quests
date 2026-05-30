import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProjectPickerModal from '../features/projects/project-picker-modal';
import { useActiveProjectStore } from '../stores/active-project-store';
import type { Project } from '@code-quests/shared';
import { api } from '../lib/api';

vi.mock('../lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/api')>();
  return {
    ...original,
    api: {
      ...original.api,
      projects: {
        list: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

const sampleProject = (over: Partial<Project> = {}): Project => ({
  id: 'p-1',
  name: 'Existing Project',
  path: '/tmp/existing-project',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastUsedAt: null,
  ...over,
});

function renderPicker(props: { onClose?: () => void } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ProjectPickerModal onClose={props.onClose ?? vi.fn()} />
      </QueryClientProvider>,
    ),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useActiveProjectStore.setState({ activeProjectId: null });
  vi.mocked(api.projects.list).mockResolvedValue([]);
});

afterEach(() => {
  localStorage.clear();
});

describe('ProjectPickerModal', () => {
  it('renders dialog with title and an empty-state hint when no projects exist', async () => {
    renderPicker();
    expect(screen.getByRole('dialog', { name: 'Choose a Project' })).toBeDefined();
    await waitFor(() => {
      expect(screen.getByText(/No projects yet/i)).toBeDefined();
    });
  });

  it('lists existing projects and marks the active one', async () => {
    const projects = [
      sampleProject({ id: 'p-1', name: 'Alpha', path: '/tmp/a' }),
      sampleProject({ id: 'p-2', name: 'Beta', path: '/tmp/b' }),
    ];
    vi.mocked(api.projects.list).mockResolvedValue(projects);
    useActiveProjectStore.setState({ activeProjectId: 'p-2' });

    renderPicker();
    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeDefined();
      expect(screen.getByText('Beta')).toBeDefined();
    });
    const radios = screen.getAllByRole('radio');
    const beta = radios.find((r) => r.getAttribute('aria-label')?.includes('Beta'));
    expect(beta?.getAttribute('aria-checked')).toBe('true');
  });

  it('selecting a project sets it active and closes the modal', async () => {
    const projects = [sampleProject({ id: 'p-1', name: 'Alpha', path: '/tmp/a' })];
    vi.mocked(api.projects.list).mockResolvedValue(projects);

    const onClose = vi.fn();
    const user = userEvent.setup();
    renderPicker({ onClose });

    await waitFor(() => expect(screen.getByText('Alpha')).toBeDefined());

    await user.click(screen.getByRole('radio', { name: /Select project Alpha/ }));

    expect(useActiveProjectStore.getState().activeProjectId).toBe('p-1');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('adding a project posts to api.projects.create, makes it active, and surfaces it', async () => {
    const created = sampleProject({ id: 'p-new', name: 'Brand New', path: '/tmp/new' });
    let firstList = true;
    vi.mocked(api.projects.list).mockImplementation(async () => {
      if (firstList) {
        firstList = false;
        return [];
      }
      return [created];
    });
    vi.mocked(api.projects.create).mockResolvedValue(created);

    const user = userEvent.setup();
    renderPicker();
    await waitFor(() => expect(screen.getByText(/No projects yet/i)).toBeDefined());

    await user.type(screen.getByLabelText('Name'), 'Brand New');
    await user.type(screen.getByLabelText('Absolute path'), '/tmp/new');
    await user.click(screen.getByRole('button', { name: 'Add Project' }));

    await waitFor(() => {
      expect(vi.mocked(api.projects.create)).toHaveBeenCalledWith(
        { name: 'Brand New', path: '/tmp/new' },
        expect.anything(),
      );
    });
    await waitFor(() => {
      expect(useActiveProjectStore.getState().activeProjectId).toBe('p-new');
    });
    await waitFor(() => {
      expect(screen.getByText('Brand New')).toBeDefined();
    });
  });

  it('inline error appears when name is empty on submit', async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.type(screen.getByLabelText('Absolute path'), '/tmp/x');
    await user.click(screen.getByRole('button', { name: 'Add Project' }));
    expect(screen.getByText(/at least 1/i, { exact: false })).toBeDefined();
    expect(vi.mocked(api.projects.create)).not.toHaveBeenCalled();
  });

  it('deleting the active project clears the active selection', async () => {
    const projects = [sampleProject({ id: 'p-1', name: 'Alpha', path: '/tmp/a' })];
    vi.mocked(api.projects.list).mockResolvedValue(projects);
    vi.mocked(api.projects.delete).mockResolvedValue(undefined);
    useActiveProjectStore.setState({ activeProjectId: 'p-1' });

    const user = userEvent.setup();
    renderPicker();
    await waitFor(() => expect(screen.getByText('Alpha')).toBeDefined());

    await user.click(screen.getByRole('button', { name: 'Delete project Alpha' }));

    await waitFor(() => {
      expect(vi.mocked(api.projects.delete)).toHaveBeenCalledWith('p-1');
    });
    await waitFor(() => {
      expect(useActiveProjectStore.getState().activeProjectId).toBeNull();
    });
  });
});
