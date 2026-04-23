import { Dices } from 'lucide-react';
import type { AdvisorSkill } from '../../types/advisor';
import { AdvisorCard } from './AdvisorCard';

interface Props {
  advisors: AdvisorSkill[];
  selected: string[];
  onToggle: (id: string) => void;
  onRandom: () => void;
}

export function AdvisorPicker({ advisors, selected, onToggle, onRandom }: Props) {
  const visible = advisors.filter(
    (a) => !a.frontmatter.id.startsWith('valid-') && !a.frontmatter.id.startsWith('invalid-'),
  );
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">
          2. 选择智囊团成员
        </h2>
        <button
          onClick={onRandom}
          className="text-xs flex items-center gap-1 text-stone-500 hover:text-stone-900 transition-colors bg-stone-100 hover:bg-stone-200 px-2 py-1 rounded-md"
        >
          <Dices size={14} /> 随机挑选
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {visible.map((a) => (
          <AdvisorCard
            key={a.frontmatter.id}
            advisor={a}
            selected={selected.includes(a.frontmatter.id)}
            onToggle={() => onToggle(a.frontmatter.id)}
          />
        ))}
      </div>
    </section>
  );
}
