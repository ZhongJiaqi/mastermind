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
    advisor: process.env.MODEL_ADVISOR || 'qwen3-plus',
    analyzer: process.env.MODEL_SYNTHESIZER || 'qwen3-max',
    host: process.env.MODEL_HOST || 'qwen3-plus',
  };
}
