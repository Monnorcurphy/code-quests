import { create } from 'zustand';

const STORAGE_KEY = 'cq:active-project-id';

function readPersisted(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null || raw === '') return null;
    return raw;
  } catch {
    return null;
  }
}

function writePersisted(id: string | null): void {
  try {
    if (id === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, id);
    }
  } catch {
    /* ignore — quota or disabled storage */
  }
}

interface ActiveProjectState {
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
}

export const useActiveProjectStore = create<ActiveProjectState>((set) => ({
  activeProjectId: readPersisted(),
  setActiveProjectId: (id) => {
    writePersisted(id);
    set({ activeProjectId: id });
  },
}));

export const ACTIVE_PROJECT_STORAGE_KEY = STORAGE_KEY;
