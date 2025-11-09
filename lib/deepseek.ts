import OpenAI from 'openai';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const baseURL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com';

export const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL
});

export async function callDeepseekJSON<T>(messages: ChatMessage[], fallback: T, opts?: { model?: string; maxRetries?: number }): Promise<T> {
  const model = opts?.model ?? 'deepseek-chat';
  const maxRetries = opts?.maxRetries ?? 1;

  if (!process.env.DEEPSEEK_API_KEY) {
    return fallback;
  }

  let attempt = 0;
  let lastError: unknown;
  let payload = [...messages];

  while (attempt <= maxRetries) {
    try {
      const completion = await deepseekClient.chat.completions.create({
        model,
        messages: payload,
        response_format: { type: 'json_object' }
      });

      const content = completion.choices[0]?.message?.content ?? '';
      const parsed = JSON.parse(content) as T;
      return parsed;
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt > maxRetries) {
        console.warn('Deepseek JSON parsing failed, using fallback', error);
        return fallback;
      }
      const reminder: ChatMessage = {
        role: 'system',
        content:
          '上一次输出格式错误。请严格只输出 JSON 对象，缺失字段使用 null，并补充 uncertain_reason。'
      };
      payload =
        payload.length > 0 ? [payload[0], reminder, ...payload.slice(1)] : [reminder];
    }
  }

  console.warn('Deepseek fallback triggered', lastError);
  return fallback;
}
