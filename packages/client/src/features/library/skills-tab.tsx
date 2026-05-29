import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import SkillCandidateCard from './skill-candidate-card';
import ForgeSkillModal from './forge-skill-modal';
import type { Skill } from '@code-quests/shared';

function RetireButton({ skill }: { skill: Skill }) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRetire() {
    setIsLoading(true);
    setError(null);
    try {
      await api.skills.retire(skill.id);
      void queryClient.invalidateQueries({ queryKey: ['skills'] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to retire skill';
      setError(msg);
      setIsLoading(false);
    }
  }

  return (
    <>
      {error && (
        <span role="alert" className="skills-retire-error">{error}</span>
      )}
      <button
        type="button"
        className="btn-secondary skills-retire-btn"
        onClick={() => void handleRetire()}
        disabled={isLoading}
        aria-busy={isLoading ? 'true' : 'false'}
        aria-label={`Retire skill: ${skill.name}`}
      >
        {isLoading ? 'Retiring…' : 'Retire'}
      </button>
    </>
  );
}

export default function SkillsTab() {
  const { data: skills = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['skills'],
    queryFn: () => api.skills.list(),
  });

  const { data: monsterTypes = [] } = useQuery({
    queryKey: ['monster-types'],
    queryFn: () => api.monsters.listTypes(),
  });

  const [showForgeModal, setShowForgeModal] = useState(false);
  const forgeButtonRef = useRef<HTMLButtonElement>(null);

  const candidates = skills.filter((s) => s.status === 'candidate');
  const activeSkills = skills.filter((s) => s.status === 'active');

  if (isLoading) {
    return (
      <div className="skills-tab-loading" aria-live="polite">
        <p>Loading skills…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="skills-tab-error">
        <p>Could not load skills. Make sure the server is running.</p>
        <button type="button" className="btn-secondary" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
    <div className="skills-tab">
      <section aria-labelledby="skill-candidates-heading">
        <h3 id="skill-candidates-heading" className="skills-section-heading">
          Skill Candidates
        </h3>
        {candidates.length === 0 ? (
          <p className="skills-empty-hint">
            No skill candidates yet. Slay the same kind of monster a few times and they will appear here.
          </p>
        ) : (
          <div className="skill-candidates-list">
            {candidates.map((skill) => (
              <SkillCandidateCard key={skill.id} skill={skill} monsterTypes={monsterTypes} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="unlocked-skills-heading" className="skills-active-section">
        <h3 id="unlocked-skills-heading" className="skills-section-heading">
          Unlocked Skills
        </h3>
        {activeSkills.length === 0 ? (
          <div className="skills-empty-state">
            <p className="skills-empty-hint">
              No skills unlocked yet. Confirm a candidate above, or forge one now.
            </p>
            <button
              ref={forgeButtonRef}
              type="button"
              className="btn-secondary"
              onClick={() => setShowForgeModal(true)}
            >
              ⚒ Forge a Skill
            </button>
          </div>
        ) : (
          <div className="skills-table-wrap">
            <table className="skills-table" aria-label="Unlocked skills">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Counters</th>
                  <th scope="col">Hit Count</th>
                  <th scope="col">Created</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {activeSkills.map((skill) => {
                  const types = monsterTypes.filter((t) => skill.monsterTypeIds.includes(t.id));
                  const createdDate = new Date(skill.createdAt).toLocaleDateString();
                  return (
                    <tr key={skill.id} className="skills-table-row">
                      <td className="skills-cell skills-cell--name">{skill.name}</td>
                      <td className="skills-cell">
                        <span className="skills-type-chips">
                          {types.length > 0
                            ? types.map((t) => (
                                <span key={t.id} className="skill-type-chip skill-type-chip--sm">
                                  {t.name}
                                </span>
                              ))
                            : skill.monsterTypeIds.map((id) => (
                                <span key={id} className="skill-type-chip skill-type-chip--sm">
                                  {id}
                                </span>
                              ))}
                        </span>
                      </td>
                      <td className="skills-cell skills-cell--num">{skill.hitCount}</td>
                      <td className="skills-cell">{createdDate}</td>
                      <td className="skills-cell skills-cell--actions">
                        <RetireButton skill={skill} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>

    {showForgeModal && (
      <ForgeSkillModal
        onClose={() => setShowForgeModal(false)}
        onSuccess={() => { /* skills query already invalidated inside modal */ }}
        triggerRef={forgeButtonRef}
      />
    )}
    </>
  );
}
