export interface DecisionSessionInput {
  question: string;
  context?: string;
  options?: string;
  leaning?: string;
}

export interface Clarification {
  id: string;
  question: string;
  why: string;
  answer: string;
}

export interface AdvisorRound {
  advisorId: string;
  advisorName: string;
  content: string;           // stripped（显示用）
  fullText: string;          // 含 meta（传给 analyze 用）
  status: 'pending' | 'streaming' | 'done' | 'error';
  error?: string;
  meta: { usedModels: string[]; modelBriefs: Record<string, string> };
}

export interface DecisionCard {
  advisorId: string;
  characterName: string;
  conclusion: string;
  reasoning: string;
  mentalModels: Array<{ name: string; briefOfUsage: string }>;
  discrepancy?: string;
}

export interface AnalysisState {
  status: 'idle' | 'pending' | 'streaming' | 'done' | 'error';
  cards: DecisionCard[];
  error?: string;
}

export type MeetingState =
  | { kind: 'idle' }
  | { kind: 'clarify-pending'; questions: Clarification[] }
  | { kind: 'meeting-running' }
  | { kind: 'meeting-done' };

export interface DecisionSession {
  id: string;
  startedAt: number;
  endedAt?: number;
  input: DecisionSessionInput;
  clarifications: Clarification[];
  selectedAdvisorIds: string[];
  rounds: AdvisorRound[];
  analysis: AnalysisState;
  state: MeetingState;
}
