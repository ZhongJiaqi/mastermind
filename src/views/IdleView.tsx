import { ADVISORS } from 'virtual:advisors';
import { SCENARIOS } from '../constants';
import { AdvisorPicker } from '../components/advisor/AdvisorPicker';
import { DecisionForm } from '../components/decision/DecisionForm';
import { ScenarioShortcuts } from '../components/decision/ScenarioShortcuts';
import { SubmitButton } from '../components/decision/SubmitButton';
import { EmptyStateCard } from '../components/common/EmptyStateCard';

interface InputV {
  question: string;
  context?: string;
  options?: string;
  leaning?: string;
}

interface Props {
  input: InputV;
  selectedAdvisorIds: string[];
  onInputChange: (patch: Partial<InputV>) => void;
  onAdvisorToggle: (id: string) => void;
  onRandomize: () => void;
  onScenarioPick: (prompt: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  error?: string;
}

export function IdleView(p: Props) {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-5 space-y-8">
        <DecisionForm value={p.input} onChange={p.onInputChange} />
        <ScenarioShortcuts scenarios={SCENARIOS} onPick={p.onScenarioPick} />
        <AdvisorPicker
          advisors={ADVISORS}
          selected={p.selectedAdvisorIds}
          onToggle={p.onAdvisorToggle}
          onRandom={p.onRandomize}
        />
        <SubmitButton disabled={!p.canSubmit} onClick={p.onSubmit} />
        {p.error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">
            {p.error}
          </div>
        )}
      </div>
      <div className="lg:col-span-7">
        <EmptyStateCard />
      </div>
    </div>
  );
}
