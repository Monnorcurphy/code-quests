import AdvisorModal, { type ProposedRefinements } from '../advisors/advisor-modal';

// Council = the War Room's holistic advisor. After the Advisor refactor
// this is a thin preset that points AdvisorModal at the 'council' kind.
// Kept as a separate import path so existing callers (DraftForm, tests)
// don't have to know about the underlying generalisation.

export type { ProposedRefinements };

interface CouncilModalProps {
  draftQuest: {
    title?: string;
    description?: string;
    acceptanceCriteria?: string[];
  };
  defaultModelId?: string | null;
  onClose: () => void;
  onApplyRefinements?: (refinements: ProposedRefinements) => void;
}

export default function CouncilModal(props: CouncilModalProps) {
  return (
    <AdvisorModal
      kind="council"
      npcName="The Council"
      npcRole="War Room elders"
      intro="A panel of seasoned campaigners reads your draft, asks clarifying questions, and proposes refinements. Stop when the spec feels precise — then close and dispatch."
      starterPrompt={`The Council awaits your first question. Try: "Is this title precise enough?" or "What edge cases am I missing?"`}
      inputPlaceholder="Ask the Council a question, or describe what you're unsure about. Ctrl/Cmd+Enter to send."
      draftQuest={props.draftQuest}
      defaultModelId={props.defaultModelId ?? null}
      onClose={props.onClose}
      {...(props.onApplyRefinements ? { onApplyRefinements: props.onApplyRefinements } : {})}
    />
  );
}
