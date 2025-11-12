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

type CompletionOptions = {
  model?: string;
  maxRetries?: number;
  extraBody?: Record<string, unknown>;
  responseFormat?: OpenAI.ChatCompletionCreateParamsNonStreaming['response_format'];
  topLevelParams?: Record<string, unknown>;
};

export type CallOptions = Omit<CompletionOptions, 'responseFormat'>;

export async function callQwenCompletion(
  messages: ChatMessage[],
  opts?: CompletionOptions
): Promise<OpenAI.ChatCompletion | null> {
  const model = opts?.model ?? 'qwen-plus';
  const maxRetries = opts?.maxRetries ?? 1;

  if (!process.env.QWEN_API_KEY) {
    return null;
  }

  let attempt = 0;
  let lastError: unknown;
  let payload = [...messages];

  while (attempt <= maxRetries) {
    try {
      const request: OpenAI.ChatCompletionCreateParamsNonStreaming = {
        model,
        messages: payload,
        stream: false
      };
      if (opts?.responseFormat) {
        request.response_format = opts.responseFormat;
      }
      if (opts?.extraBody) {
        (request as any).extra_body = opts.extraBody;
      }
      if (opts?.topLevelParams) {
        Object.assign(request as unknown as Record<string, unknown>, opts.topLevelParams);
      }
      const completion = await qwenClient.chat.completions.create(request);
      return completion;
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt > maxRetries) {
        console.warn('Qwen completion failed', error);
        return null;
      }
      const reminder: ChatMessage = {
        role: 'system',
        content:
          '上一次输出格式错误。请严格按照要求作答，并保持 JSON 可解析。'
      };
      payload =
        payload.length > 0 ? [payload[0], reminder, ...payload.slice(1)] : [reminder];
    }
  }

  console.warn('Qwen fallback triggered', lastError);
  return null;
}

export async function callQwenJSON<T>(
  messages: ChatMessage[],
  fallback: T,
  opts?: CallOptions
): Promise<T> {
  const completion = await callQwenCompletion(messages, {
    ...opts,
    responseFormat: { type: 'json_object' }
  });
  if (!completion) {
    return fallback;
  }
  try {
    const content = completion.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(content) as T;
    return parsed;
  } catch (error) {
    console.warn('Qwen JSON parsing failed, using fallback', error);
    return fallback;
  }
}
