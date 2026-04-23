import { useState } from 'react';
import type { Clarification } from '../../types/session';

interface Props {
  questions: Clarification[];
  onSubmit: (answers: Record<string, string>) => void;
}

export function InlineClarifyCards({ questions, onSubmit }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const allAnswered = questions.every((q) => (answers[q.id] ?? '').trim().length > 0);
  return (
    <div className="space-y-3">
      {questions.map((q) => (
        <div key={q.id} className="border border-stone-200 rounded-2xl bg-white p-4">
          <p className="text-sm font-medium text-stone-900">{q.question}</p>
          <p className="text-xs text-stone-500 mt-0.5">{q.why}</p>
          <textarea
            value={answers[q.id] ?? ''}
            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
            className="mt-2 w-full p-2 text-sm border border-stone-200 rounded-lg"
            rows={2}
          />
        </div>
      ))}
      <button
        disabled={!allAnswered}
        onClick={() => onSubmit(answers)}
        className="w-full py-3 bg-stone-900 text-white rounded-xl disabled:opacity-50"
      >
        继续会议
      </button>
    </div>
  );
}
