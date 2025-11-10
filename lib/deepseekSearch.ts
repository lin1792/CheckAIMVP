import { callDeepseekJSON, type ChatMessage } from './deepseek';
import type { Claim, EvidenceCandidate } from './schemas';

type DeepseekEvidence = {
  title: string;
  url: string;
  quote: string;
  published_at?: string | null;
  authority?: number | null;
  source?: string | null;
};

type DeepseekSearchResponse = {
  evidences: DeepseekEvidence[];
};

const FALLBACK: DeepseekSearchResponse = { evidences: [] };

export async function deepseekSearch(params: {
  claim: Claim;
  context?: string;
  facets?: string[];
  limit: number;
}): Promise<EvidenceCandidate[]> {
  const { claim, context, facets = [], limit } = params;
  if (!process.env.DEEPSEEK_API_KEY) return [];

  const system: ChatMessage = {
    role: 'system',
    content:
      '你是联网事实核查助手。针对给定主张与上下文，主动检索最新可靠来源并输出 JSON {"evidences":[{"title":string,"url":string,"quote":string,"published_at":string|null,"authority":0-1}]}。URL 必须真实存在，quote 为原文摘录，按可靠度排序。'
  };
  const user: ChatMessage = {
    role: 'user',
    content: JSON.stringify({
      claim: claim.text,
      normalized: claim.normalized,
      context,
      facets,
      limit
    })
  };

  const response = await callDeepseekJSON<DeepseekSearchResponse>([system, user], FALLBACK, {
    maxRetries: 2
  });
  if (!Array.isArray(response.evidences) || !response.evidences.length) {
    return [];
  }
  return response.evidences.slice(0, limit).map(toEvidenceCandidate);
}

function toEvidenceCandidate(item: DeepseekEvidence): EvidenceCandidate {
  const url = item.url?.trim() ?? '';
  return {
    id: crypto.randomUUID(),
    source: inferSource(url),
    url,
    title: item.title?.trim() || 'Untitled',
    quote: item.quote?.trim() || 'No snippet',
    published_at: item.published_at ?? undefined,
    authority: clampAuthority(item.authority ?? estimateAuthority(url))
  };
}

function inferSource(url: string): EvidenceCandidate['source'] {
  if (url.includes('wikipedia.org')) return 'wikipedia';
  if (url.includes('wikidata.org')) return 'wikidata';
  return 'web';
}

function estimateAuthority(url: string): number {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.endsWith('.gov') || hostname.includes('.gov.')) return 0.9;
    if (hostname.endsWith('.edu') || hostname.includes('.edu.')) return 0.85;
    if (hostname.endsWith('.org')) return 0.75;
  } catch {
    return 0.6;
  }
  return 0.6;
}

function clampAuthority(value: number): number {
  if (!Number.isFinite(value)) return 0.6;
  return Math.max(0.2, Math.min(0.95, Number(value.toFixed(2))));
}
