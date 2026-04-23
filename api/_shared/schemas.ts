import { z } from 'zod';

export const sessionInputSchema = z.object({
  question: z.string().min(1),
  context: z.string().optional(),
  options: z.string().optional(),
  leaning: z.string().optional(),
  clarifications: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      }),
    )
    .optional(),
});

export const intakeClarifyRequestSchema = sessionInputSchema.extend({
  selectedAdvisorIds: z.array(z.string()).min(1),
});

export const priorRoundSchema = z.object({
  advisorId: z.string(),
  advisorName: z.string(),
  content: z.string(),
});

export const advisorRequestSchema = z.object({
  session: sessionInputSchema,
  priorRounds: z.array(priorRoundSchema),
});

export const analyzeRequestSchema = z.object({
  session: sessionInputSchema,
  rounds: z
    .array(
      z.object({
        advisorId: z.string(),
        advisorName: z.string(),
        content: z.string(),
        meta: z.object({
          usedModels: z.array(z.string()),
          modelBriefs: z.record(z.string(), z.string()),
        }),
      }),
    )
    .min(1),
});

export type IntakeClarifyRequest = z.infer<typeof intakeClarifyRequestSchema>;
export type AdvisorRequest = z.infer<typeof advisorRequestSchema>;
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
