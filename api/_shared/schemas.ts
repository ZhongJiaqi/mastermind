import { z } from 'zod';

// 所有文本字段设上限：防御恶意请求把 prompt 撑到 100K+ tokens 烧账户额度。
// 数值比 spec 要求略宽，实际 UI 不会产生这么长；只是 hard ceiling。
const QUESTION_MAX = 2000;
const CONTEXT_MAX = 3000;
const OPTIONS_MAX = 2000;
const LEANING_MAX = 500;
const CLARIFICATION_Q_MAX = 500;
const CLARIFICATION_A_MAX = 1000;
const ROUND_CONTENT_MAX = 6000;
const MODEL_NAME_MAX = 80;
const MODEL_BRIEF_MAX = 400;
// 9 位预置军师的硬上限（spec §8）。
const ADVISOR_IDS_MAX = 12;

export const sessionInputSchema = z.object({
  question: z.string().min(1).max(QUESTION_MAX),
  context: z.string().max(CONTEXT_MAX).optional(),
  options: z.string().max(OPTIONS_MAX).optional(),
  leaning: z.string().max(LEANING_MAX).optional(),
  clarifications: z
    .array(
      z.object({
        question: z.string().max(CLARIFICATION_Q_MAX),
        answer: z.string().max(CLARIFICATION_A_MAX),
      }),
    )
    .max(ADVISOR_IDS_MAX)
    .optional(),
});

export const intakeClarifyRequestSchema = sessionInputSchema.extend({
  selectedAdvisorIds: z.array(z.string().max(64)).min(1).max(ADVISOR_IDS_MAX),
});

export const priorRoundSchema = z.object({
  advisorId: z.string().max(64),
  advisorName: z.string().max(64),
  content: z.string().max(ROUND_CONTENT_MAX),
});

export const advisorRequestSchema = z.object({
  session: sessionInputSchema,
  priorRounds: z.array(priorRoundSchema).max(ADVISOR_IDS_MAX),
});

export const analyzeRequestSchema = z.object({
  session: sessionInputSchema,
  rounds: z
    .array(
      z.object({
        advisorId: z.string().max(64),
        advisorName: z.string().max(64),
        content: z.string().max(ROUND_CONTENT_MAX),
        meta: z.object({
          usedModels: z.array(z.string().max(MODEL_NAME_MAX)).max(10),
          modelBriefs: z.record(
            z.string().max(MODEL_NAME_MAX),
            z.string().max(MODEL_BRIEF_MAX),
          ),
        }),
      }),
    )
    .min(1)
    .max(ADVISOR_IDS_MAX),
});

export type IntakeClarifyRequest = z.infer<typeof intakeClarifyRequestSchema>;
export type AdvisorRequest = z.infer<typeof advisorRequestSchema>;
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
