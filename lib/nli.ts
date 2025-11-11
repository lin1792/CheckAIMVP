import { callQwenJSON } from './qwen';

type Score = {
  entail: number;
  contradict: number;
  neutral: number;
};

type QwenNLIResponse = Score & { uncertain_reason?: string | null };

export async function entailmentScore(claim: string, evidence: string, context?: string): Promise<Score> {
  const fallback: QwenNLIResponse = {
    entail: 0.34,
    contradict: 0.33,
    neutral: 0.33,
    uncertain_reason: 'model_unavailable'
  };
  const prompt = [
    {
      role: 'system' as const,
      content:
        '你是事实核查 NLI 模型。收到 claim、evidence 与可选 context，输出 JSON: {"entail":0-1,"contradict":0-1,"neutral":0-1,"uncertain_reason":string|null}，三者相加=1。'
    },
    {
      role: 'user' as const,
      content: JSON.stringify({ claim, evidence, context })
    }
  ];

  const result = await callQwenJSON<QwenNLIResponse>(prompt, fallback);
  const { entail, contradict, neutral } = result as Score;
  return normalizeScore({ entail, contradict, neutral });
}

function normalizeScore(score: Score): Score {
  const total = score.entail + score.contradict + score.neutral || 1;
  return {
    entail: score.entail / total,
    contradict: score.contradict / total,
    neutral: score.neutral / total
  };
}
