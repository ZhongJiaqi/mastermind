import type { DecisionSession } from '../types/session';
import { CompactInputBar } from '../components/meeting/CompactInputBar';
import { SectionFinalDecisions } from '../components/meeting/SectionFinalDecisions';
import { AdvisorStreamCard } from '../components/meeting/AdvisorStreamCard';
import { NewMeetingButton } from '../components/common/NewMeetingButton';
import { InlineClarifyCards } from '../components/decision/InlineClarifyCards';

interface Props {
  session: DecisionSession;
  onNew: () => void;
  onRetryAdvisor: (id: string) => void;
  onSubmitClarifications: (answers: Record<string, string>) => void;
}

export function MeetingView(p: Props) {
  const { session } = p;
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <CompactInputBar input={session.input} advisorIds={session.selectedAdvisorIds} />
      {session.state.kind === 'clarify-pending' && (
        <InlineClarifyCards
          questions={session.state.questions}
          onSubmit={p.onSubmitClarifications}
        />
      )}
      {session.analysis.status === 'done' && (
        <SectionFinalDecisions cards={session.analysis.cards} />
      )}
      <section className="space-y-4">
        {session.rounds.map((r) => (
          <AdvisorStreamCard
            key={r.advisorId}
            round={r}
            onRetry={() => p.onRetryAdvisor(r.advisorId)}
          />
        ))}
      </section>
      {session.state.kind === 'meeting-done' && <NewMeetingButton onClick={p.onNew} />}
    </div>
  );
}
