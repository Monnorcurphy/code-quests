import type { Quest, Agent, MonsterEncounter, FailureSummary } from '@code-quests/shared';

const HYDRA_TYPE_ID = 'hydra_ac_mismatch';

function chooseRecommendation(
  retries: number,
  encounters: MonsterEncounter[],
): FailureSummary['recommendation'] {
  const defeatEncounters = encounters.filter((e) => e.outcome === 'defeat');

  // Hydra (AC mismatch) takes priority — scope is the root cause, not skill level
  const hydraCount = encounters.filter((e) => e.monsterTypeId === HYDRA_TYPE_ID).length;
  if (hydraCount >= 2) return 'break_into_smaller';

  if (retries >= 3 && defeatEncounters.length >= 3) {
    const typeIds = defeatEncounters.map((e) => e.monsterTypeId).filter(Boolean);
    if (typeIds.length === defeatEncounters.length && new Set(typeIds).size === 1) {
      return 'level_up_first';
    }
  }

  if (retries <= 1 && defeatEncounters.length <= 1) return 'repost_with_clarification';

  return 'retire';
}

function buildNotes(
  quest: Quest,
  retries: number,
  fatalEncounter: MonsterEncounter | undefined,
  recommendation: FailureSummary['recommendation'],
): string {
  const monsterName = fatalEncounter?.monsterName ?? 'an unknown obstacle';

  if (recommendation === 'level_up_first') {
    return (
      `The adventurer was repeatedly defeated by ${monsterName} across ${retries} attempts, ` +
      `suggesting a skill gap that must be addressed before retrying. ` +
      `The quest "${quest.title}" demands capabilities the current adventurer has not yet mastered. ` +
      `Consider selecting a more experienced adventurer or equipping additional skills.`
    );
  }

  if (recommendation === 'break_into_smaller') {
    return (
      `Multiple acceptance-criteria mismatches were detected during "${quest.title}", ` +
      `indicating the scope is too broad for a single quest. ` +
      `Breaking this into smaller, more focused quests will reduce the risk of Hydra encounters. ` +
      `Each child quest should have clear, singular acceptance criteria.`
    );
  }

  if (recommendation === 'repost_with_clarification') {
    return (
      `The quest "${quest.title}" failed on its first attempt due to ${monsterName}. ` +
      `The failure appears to stem from unclear specifications rather than adventurer capability. ` +
      `Clarifying the acceptance criteria or providing additional context should resolve the issue.`
    );
  }

  const retriesText = retries === 1 ? '1 attempt' : `${retries} attempts`;
  return (
    `After ${retriesText}, quest "${quest.title}" has been returned to town without a clear path to resolution. ` +
    `The pattern of failures does not suggest a straightforward fix. ` +
    `The quest has been retired from the active roster.`
  );
}

export function buildFailureSummary(
  quest: Quest,
  agents: Agent[],
  encounters: MonsterEncounter[],
): FailureSummary {
  const defeatEncounters = encounters
    .filter((e) => e.outcome === 'defeat')
    .sort((a, b) => b.appearedAt.localeCompare(a.appearedAt));

  const fatalEncounter = defeatEncounters[0];
  const fatalEncounterId = fatalEncounter?.id ?? '';
  const retries = agents.length;
  const recommendation = chooseRecommendation(retries, encounters);
  const notes = buildNotes(quest, retries, fatalEncounter, recommendation);

  return { fatalEncounterId, retries, recommendation, notes, reason: '' };
}
