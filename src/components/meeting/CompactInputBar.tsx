import { ADVISORS } from 'virtual:advisors';
import type { DecisionSessionInput } from '../../types/session';

interface Props {
  input: DecisionSessionInput;
  advisorIds: string[];
}

export function CompactInputBar({ input, advisorIds }: Props) {
  const names = advisorIds
    .map((id) => ADVISORS.find((a) => a.frontmatter.id === id)?.frontmatter.name)
    .filter(Boolean)
    .join('、');
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-4">
      <p className="text-sm font-medium text-stone-900 line-clamp-2">{input.question}</p>
      <p className="text-xs text-stone-500 mt-1">与会军师：{names}</p>
    </div>
  );
}
