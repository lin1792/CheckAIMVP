import OpenAI from 'openai';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const baseURL = process.env.QWEN_BASE_URL ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1';

export const qwenClient = new OpenAI({
  apiKey: process.env.QWEN_API_KEY,
  baseURL
});

type CallOptions = {
  model?: string;
  maxRetries?: number;
  extraBody?: Record<string, unknown>;
};

export async function callQwenJSON<T>(
  messages: ChatMessage[],
  fallback: T,
  opts?: CallOptions
): Promise<T> {
  const model = opts?.model ?? 'qwen-plus';
  const maxRetries = opts?.maxRetries ?? 1;

  if (!process.env.QWEN_API_KEY) {
    return fallback;
  }

  let attempt = 0;
  let lastError: unknown;
  let payload = [...messages];

  while (attempt <= maxRetries) {
    try {
      const request: OpenAI.ChatCompletionCreateParamsNonStreaming = {
        model,
        messages: payload,
        response_format: { type: 'json_object' },
        stream: false
      };
      if (opts?.extraBody) {
        (request as any).extra_body = opts.extraBody;
      }
      const completion = await qwenClient.chat.completions.create(request);

      const content = completion.choices[0]?.message?.content ?? '';
      const parsed = JSON.parse(content) as T;
      return parsed;
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt > maxRetries) {
        console.warn('Qwen JSON parsing failed, using fallback', error);
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

  console.warn('Qwen fallback triggered', lastError);
  return fallback;
}
