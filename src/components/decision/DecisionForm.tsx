import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface Input {
  question: string;
  context?: string;
  options?: string;
  leaning?: string;
}

interface Props {
  value: Input;
  onChange: (patch: Partial<Input>) => void;
}

export function DecisionForm({ value, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">
        1. 描述你的困境
      </h2>
      <textarea
        value={value.question}
        onChange={(e) => onChange({ question: e.target.value })}
        placeholder="例如：我目前在一家大厂工作，感觉没有成长空间..."
        className="w-full h-40 p-4 bg-white border border-stone-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-stone-900 focus:border-stone-900 transition-all resize-none text-sm leading-relaxed"
      />
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900"
      >
        <ChevronDown
          size={14}
          className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
        {expanded ? '收起补充信息' : '补充背景 / 选项 / 倾向（可选）'}
      </button>
      {expanded && (
        <div className="space-y-2">
          <textarea
            value={value.context ?? ''}
            onChange={(e) => onChange({ context: e.target.value })}
            placeholder="背景（约束条件/既有情况）"
            className="w-full p-3 bg-white border border-stone-200 rounded-xl text-sm resize-none"
            rows={2}
          />
          <textarea
            value={value.options ?? ''}
            onChange={(e) => onChange({ options: e.target.value })}
            placeholder="正在考虑的选项"
            className="w-full p-3 bg-white border border-stone-200 rounded-xl text-sm resize-none"
            rows={2}
          />
          <textarea
            value={value.leaning ?? ''}
            onChange={(e) => onChange({ leaning: e.target.value })}
            placeholder="我的倾向"
            className="w-full p-3 bg-white border border-stone-200 rounded-xl text-sm resize-none"
            rows={2}
          />
        </div>
      )}
    </section>
  );
}
