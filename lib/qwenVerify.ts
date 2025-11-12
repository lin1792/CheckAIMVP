import { callQwenJSON, type ChatMessage } from './qwen';
import type { Claim, EvidenceCandidate, Verification } from './schemas';

type QwenVerificationResponse = {
  label: Verification['label'];
  confidence: number;
  reason: string;
  citations: Array<{
    url: string;
    title?: string;
  }>;
};

const DEFAULT_RESPONSE: QwenVerificationResponse = {
  label: 'INSUFFICIENT',
  confidence: 0.4,
  reason: '未获得可用证据',
  citations: []
};

export async function qwenVerify(params: {
  claim: Claim;
  evidences: EvidenceCandidate[];
  context?: string;
}): Promise<Verification | null> {
  if (!process.env.QWEN_API_KEY) return null;
  const { claim, evidences, context } = params;
  if (!evidences.length) return null;

  const payload = {
    claim: claim.text,
    normalized: claim.normalized,
    context,
    evidences: evidences.slice(0, 6).map((item, idx) => ({
      id: idx + 1,
      title: item.title,
      quote: item.quote,
      url: item.url,
      authority: item.authority,
      published_at: item.published_at ?? null
    }))
  };

  const system: ChatMessage = {
    role: 'system',
    content:
      '你是事实核查裁定器。结合提供的证据，输出 JSON {"label":"SUPPORTED|REFUTED|DISPUTED|INSUFFICIENT","confidence":0-1,"reason":string,"citations":[{"url":string,"title":string}]}。理由必须使用自然语言，引用证据时请使用 [ref_<number>] 形式或直接提及来源名称，严禁提到 JSON 字段名（如 id、claims）或任何代码术语，禁止臆造引用。'
  };
  const user: ChatMessage = {
    role: 'user',
    content: JSON.stringify(payload)
  };

  const res = await callQwenJSON<QwenVerificationResponse>([system, user], DEFAULT_RESPONSE, {
    maxRetries: 2
  });
  const verdict = normalizeResponse(res);
  return {
    claimId: claim.id,
    label: verdict.label,
    confidence: verdict.confidence,
    reason: verdict.reason,
    citations: verdict.citations.map((c) => c.url).slice(0, 10)
  };
}

function normalizeResponse(res: QwenVerificationResponse): QwenVerificationResponse {
  if (!res) return DEFAULT_RESPONSE;
  const label = mapLabel(res.label);
  const confidence = clamp(res.confidence ?? 0.4);
  const reason = cleanReason(res.reason ?? '');
  const citations = Array.isArray(res.citations)
    ? res.citations
        .map((c) => ({
          url: c?.url?.trim() ?? '',
          title: c?.title?.trim() || ''
        }))
        .filter((c) => c.url)
    : [];
  return { label, confidence, reason, citations };
}

function mapLabel(label: string | undefined): Verification['label'] {
  const upper = (label ?? '').toUpperCase();
  if (upper.includes('SUPPORT')) return 'SUPPORTED';
  if (upper.includes('REFUTE') || upper.includes('FALSE')) return 'REFUTED';
  if (upper.includes('DISPUTE') || upper.includes('MIXED')) return 'DISPUTED';
  return 'INSUFFICIENT';
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0.4;
  return Math.max(0.1, Math.min(1, Number(value.toFixed(3))));
}

function cleanReason(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return DEFAULT_RESPONSE.reason;
  const withoutCodeRefs = trimmed.replace(/\(?(?:id|ID)\s*:\s*[^)]+\)?/g, '').replace(/`{1,3}[^`]+`{1,3}/g, '');
  const normalized = withoutCodeRefs.replace(/\s{2,}/g, ' ').trim();
  return normalized || DEFAULT_RESPONSE.reason;
}
