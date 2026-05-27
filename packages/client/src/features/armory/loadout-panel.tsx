import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFocusTrap } from '../../lib/use-focus-trap';
import { useTownStore } from '../../stores/town-store';
import { api } from '../../lib/api';
import { useEquipmentMutation } from './use-equipment-mutation';

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

interface Props {
  onClose: () => void;
}

export default function LoadoutPanel({ onClose }: Props) {
  const selectedQuestId = useTownStore((s) => s.selectedQuestId);
  const panelRef = useFocusTrap(onClose);

  const { data: skills = [], isLoading: skillsLoading } = useQuery({
    queryKey: ['skills'],
    queryFn: api.equipment.skills,
  });
  const { data: tools = [], isLoading: toolsLoading } = useQuery({
    queryKey: ['tools'],
    queryFn: api.equipment.tools,
  });
  const { data: mcpServers = [], isLoading: mcpLoading } = useQuery({
    queryKey: ['mcp-servers'],
    queryFn: api.equipment.mcpServers,
  });

  const { data: quests } = useQuery({
    queryKey: ['quests'],
    queryFn: api.quests.list,
  });
  const quest = selectedQuestId ? quests?.find((q) => q.id === selectedQuestId) : undefined;

  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [selectedMcpIds, setSelectedMcpIds] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (quest && !initialized) {
      setSelectedSkillIds(quest.equipment?.skillIds ?? []);
      setSelectedToolIds(quest.equipment?.toolIds ?? []);
      setSelectedMcpIds(quest.equipment?.mcpServerIds ?? []);
      setInitialized(true);
    }
  }, [quest, initialized]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const mutation = useEquipmentMutation();
  const catalogLoading = skillsLoading || toolsLoading || mcpLoading;
  const isSaving = saveStatus === 'saving';

  async function handleSave() {
    if (!selectedQuestId) return;
    setSaveStatus('saving');
    setErrorMsg('');
    try {
      await mutation.mutateAsync({
        questId: selectedQuestId,
        equipment: {
          skillIds: selectedSkillIds,
          toolIds: selectedToolIds,
          mcpServerIds: selectedMcpIds,
        },
      });
      setSaveStatus('success');
      timerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e) {
      setSaveStatus('error');
      setErrorMsg(e instanceof Error ? e.message : 'Failed to save loadout. Please try again.');
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="armory-title">
      <div ref={panelRef} className="modal-panel armory-panel">
        <h2 id="armory-title" className="modal-title">
          Armory — Equipment Loadout
        </h2>

        {!selectedQuestId ? (
          <>
            <p className="modal-body">
              No quest selected. Select a quest from the Quest Board before equipping.
            </p>
            <div className="form-actions">
              <button className="btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="modal-body">
              Choose the skills, tools, and MCP servers for this quest.
            </p>

            {catalogLoading ? (
              <p className="armory-loading" aria-live="polite" aria-busy="true">
                Loading catalog…
              </p>
            ) : (
              <div className="armory-columns">
                <LoadoutColumn
                  heading="Skills"
                  items={skills}
                  selectedIds={selectedSkillIds}
                  onChange={setSelectedSkillIds}
                  disabled={isSaving}
                />
                <LoadoutColumn
                  heading="Tools"
                  items={tools}
                  selectedIds={selectedToolIds}
                  onChange={setSelectedToolIds}
                  disabled={isSaving}
                />
                <LoadoutColumn
                  heading="MCP Servers"
                  items={mcpServers}
                  selectedIds={selectedMcpIds}
                  onChange={setSelectedMcpIds}
                  disabled={isSaving}
                />
              </div>
            )}

            <div aria-live="polite" aria-atomic="true" className="armory-status">
              {saveStatus === 'success' && (
                <p className="armory-success" role="status">
                  Loadout saved!
                </p>
              )}
            </div>

            {saveStatus === 'error' && (
              <p className="armory-error" role="alert">
                {errorMsg}
              </p>
            )}

            <div className="form-actions">
              <button
                className="btn-primary"
                onClick={() => {
                  void handleSave();
                }}
                disabled={isSaving || catalogLoading}
                aria-busy={isSaving}
              >
                {isSaving ? 'Saving…' : 'Save Loadout'}
              </button>
              <button className="btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface ColumnItem {
  id: string;
  name: string;
}

interface LoadoutColumnProps {
  heading: string;
  items: ColumnItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled: boolean;
}

function LoadoutColumn({ heading, items, selectedIds, onChange, disabled }: LoadoutColumnProps) {
  const headingId = `col-${heading.toLowerCase().replace(/\s+/g, '-')}`;

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  return (
    <section className="armory-column" aria-labelledby={headingId}>
      <h3 id={headingId} className="armory-column-heading">
        {heading}
      </h3>
      {items.length === 0 ? (
        <p className="armory-column-empty">No {heading.toLowerCase()} available.</p>
      ) : (
        <ul className="armory-column-list" role="list">
          {items.map((item) => (
            <li key={item.id} className="armory-column-item">
              <label className="armory-item-label">
                <input
                  type="checkbox"
                  className="armory-item-checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => toggle(item.id)}
                  disabled={disabled}
                  aria-label={item.name}
                />
                <span className="armory-item-name">{item.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
