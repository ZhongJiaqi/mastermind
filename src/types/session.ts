export interface DecisionSessionInput {
  question: string;
  context?: string;
  options?: string;
  leaning?: string;
}

export interface DiscussionMessage {
  id: string;
  advisorId: string;   // '' 若 parser 未匹配到 vault 中的 advisor
  advisorName: string; // 显示名（匹配到则为 frontmatter.name，否则原 speaker）
  text: string;
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
  | { kind: 'meeting-running' }
  | { kind: 'meeting-done' };

export interface DecisionSession {
  id: string;
  startedAt: number;
  endedAt?: number;
  input: DecisionSessionInput;
  selectedAdvisorIds: string[];
  messages: DiscussionMessage[];
  analysis: AnalysisState;
  state: MeetingState;
}
