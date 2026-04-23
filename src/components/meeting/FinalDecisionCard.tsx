import type { DecisionCard } from '../../types/session';

interface Props {
  card: DecisionCard;
}

export function FinalDecisionCard({ card }: Props) {
  return (
    <div className="border border-stone-200 rounded-2xl overflow-hidden bg-white">
      <div className="px-5 py-3 bg-stone-900 text-white font-semibold">{card.characterName}</div>
      <div className="p-5 space-y-4">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-1">结论</h4>
          <p className="text-stone-900 font-medium text-lg">{card.conclusion}</p>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-1">推理</h4>
          <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">{card.reasoning}</p>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
            运用的心智模型
          </h4>
          <ul className="space-y-1.5">
            {card.mentalModels.map((m) => (
              <li key={m.name} className="text-sm text-stone-700">
                <span className="font-medium">· {m.name}</span>
                <span className="text-stone-500"> — {m.briefOfUsage}</span>
              </li>
            ))}
          </ul>
        </div>
        {card.discrepancy && (
          <div className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 border border-amber-200">
            Analyst 备注: {card.discrepancy}
          </div>
        )}
      </div>
    </div>
  );
}
