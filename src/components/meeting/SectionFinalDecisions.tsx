import { CheckCircle2 } from 'lucide-react';
import { FinalDecisionCard } from './FinalDecisionCard';
import type { DecisionCard } from '../../types/session';

interface Props {
  cards: DecisionCard[];
}

export function SectionFinalDecisions({ cards }: Props) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2 text-stone-800">
        <CheckCircle2 size={20} /> 最终决策
      </h2>
      <div className="space-y-3">
        {cards.map((c) => (
          <FinalDecisionCard key={c.advisorId} card={c} />
        ))}
      </div>
    </section>
  );
}
