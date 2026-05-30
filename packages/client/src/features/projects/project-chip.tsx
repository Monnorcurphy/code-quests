import { useState } from 'react';
import type { Project } from '@code-quests/shared';
import { useActiveProjectStore } from '../../stores/active-project-store';
import { useProjects } from './use-projects';
import ProjectPickerModal from './project-picker-modal';

interface ProjectChipProps {
  /** When provided, the chip controls an externally-managed modal state. */
  onOpen?: () => void;
  /** Whether to render the modal alongside (default true). */
  manageModal?: boolean;
}

/**
 * Top-of-town chip showing the active project. Click to open the picker modal.
 * The chip is always visible from any town scene so users know what folder
 * their agent will run in before they draft a quest.
 */
export function ProjectChip({ onOpen, manageModal = true }: ProjectChipProps) {
  const activeProjectId = useActiveProjectStore((s) => s.activeProjectId);
  const { data } = useProjects();
  const [open, setOpen] = useState(false);

  const projects: Project[] = data ?? [];
  const active = projects.find((p) => p.id === activeProjectId) ?? null;

  function handleClick() {
    if (onOpen) {
      onOpen();
      return;
    }
    setOpen(true);
  }

  const label = active
    ? `📁 ${active.name}`
    : '📁 No project — click to add';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={
          active
            ? `Active project: ${active.name}. Click to change.`
            : 'No active project. Click to add one.'
        }
        aria-haspopup="dialog"
        data-testid="project-chip"
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 100,
          background: active ? 'rgba(44, 36, 22, 0.85)' : 'rgba(122, 24, 24, 0.85)',
          color: '#f0e6d2',
          border: '1px solid rgba(240, 230, 210, 0.5)',
          borderRadius: 4,
          padding: '6px 12px',
          fontSize: '0.85rem',
          fontFamily: 'inherit',
          cursor: 'pointer',
          maxWidth: 280,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={active ? `${active.name} — ${active.path}` : 'Pick a project before drafting a quest'}
      >
        {label}
      </button>
      {manageModal && open && <ProjectPickerModal onClose={() => setOpen(false)} />}
    </>
  );
}
