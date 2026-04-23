import type { AdvisorSkill } from '../../types/advisor';

interface Props {
  advisor: AdvisorSkill;
  selected: boolean;
  onToggle: () => void;
}

export function AdvisorCard({ advisor, selected, onToggle }: Props) {
  return (
    <button
      type="button"
      data-testid="advisor-card"
      onClick={onToggle}
      className={`text-left p-3 rounded-xl border transition-all ${
        selected
          ? 'bg-stone-900 border-stone-900 text-white shadow-md'
          : 'bg-white border-stone-200 hover:border-stone-400 hover:bg-stone-50'
      }`}
    >
      <div className="font-medium text-sm mb-1">{advisor.frontmatter.name}</div>
      <div className={`text-xs line-clamp-2 ${selected ? 'text-stone-300' : 'text-stone-500'}`}>
        {advisor.frontmatter.tagline}
      </div>
    </button>
  );
}
