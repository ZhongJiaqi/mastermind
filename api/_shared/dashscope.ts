import OpenAI from 'openai';

export function createDashScope(): OpenAI {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const baseURL =
    process.env.DASHSCOPE_BASE_URL ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  if (!apiKey) {
    throw new Error('DASHSCOPE_API_KEY is not configured');
  }
  return new OpenAI({ apiKey, baseURL });
}

export interface DashScopeModels {
  advisor: string;
  analyzer: string;
  host: string;
}

export function getDashScopeModels(): DashScopeModels {
  return {
    advisor: process.env.MODEL_ADVISOR || 'deepseek-v4-flash-0731',
    analyzer: process.env.MODEL_SYNTHESIZER || 'deepseek-v4-flash-0731',
    host: process.env.MODEL_HOST || 'deepseek-v4-flash-0731',
  };
}
