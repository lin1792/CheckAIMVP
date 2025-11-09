import { callDeepseekJSON } from './deepseek';

type Score = {
  entail: number;
  contradict: number;
  neutral: number;
};

const HF_API_KEY = process.env.HF_API_KEY;
const HF_NLI_MODEL = process.env.HF_NLI_MODEL ?? 'roberta-large-mnli';

async function huggingfaceScore(claim: string, evidence: string): Promise<Score | null> {
  if (!HF_API_KEY) return null;
  const res = await fetch(`https://api-inference.huggingface.co/models/${HF_NLI_MODEL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HF_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ inputs: { premise: evidence, hypothesis: claim } })
  });

  if (!res.ok) {
    console.warn('HF NLI failed', res.status);
    return null;
  }
  const data = await res.json();
  const probabilities: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data[0])
      ? data[0]
      : [];
  if (!probabilities.length) return null;
  const lookup = probabilities.reduce(
    (acc, item: any) => {
      const label = String(item.label ?? '').toLowerCase();
      if (label.includes('entail')) acc.entail = item.score ?? 0;
      if (label.includes('contrad')) acc.contradict = item.score ?? 0;
      if (label.includes('neutral')) acc.neutral = item.score ?? 0;
      return acc;
    },
    { entail: 0, contradict: 0, neutral: 0 }
  );
  const { entail, contradict, neutral } = lookup;
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

type DeepseekNLIResponse = Score & { uncertain_reason?: string | null };

export async function entailmentScore(claim: string, evidence: string): Promise<Score> {
  const hfScore = await huggingfaceScore(claim, evidence);
  if (hfScore) {
    return hfScore;
  }

  const fallback: DeepseekNLIResponse = {
    entail: 0.34,
    contradict: 0.33,
    neutral: 0.33,
    uncertain_reason: 'model_unavailable'
  };
  const prompt = [
    {
      role: 'system' as const,
      content:
        '你是事实核查 NLI 模型。收到 claim 与 evidence，输出 JSON: {"entail":0-1,"contradict":0-1,"neutral":0-1,"uncertain_reason":string|null}，三者相加=1。'
    },
    {
      role: 'user' as const,
      content: JSON.stringify({ claim, evidence })
    }
  ];

  const result = await callDeepseekJSON<DeepseekNLIResponse>(prompt, fallback);
  const { entail, contradict, neutral } = result as Score;
  return normalizeScore({ entail, contradict, neutral });
}
