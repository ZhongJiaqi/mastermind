import { User } from 'lucide-react';

export function EmptyStateCard() {
  return (
    <div className="bg-white border border-stone-200 rounded-3xl p-6 md:p-8 min-h-[600px] shadow-sm flex flex-col items-center justify-center text-stone-400 space-y-4">
      <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center">
        <User size={32} className="text-stone-300" />
      </div>
      <p className="text-sm font-medium">
        描述问题并选择人物，获取顶级思维的决策建议
      </p>
    </div>
  );
}
