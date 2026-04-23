interface Scenario {
  label: string;
  prompt: string;
}

interface Props {
  scenarios: Scenario[];
  onPick: (prompt: string) => void;
}

export function ScenarioShortcuts({ scenarios, onPick }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-stone-500 font-medium">快捷场景：</p>
      <div className="flex flex-wrap gap-2">
        {scenarios.map((s) => (
          <button
            key={s.label}
            onClick={() => onPick(s.prompt)}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-stone-200 rounded-full hover:bg-stone-100 hover:border-stone-300 transition-colors text-stone-600"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
