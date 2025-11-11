import { callQwenJSON, type ChatMessage } from './qwen';
import type { Claim, EvidenceCandidate } from './schemas';

type QwenEvidence = {
  title: string;
  url: string;
  quote: string;
  published_at?: string | null;
  authority?: number | null;
  source?: string | null;
};

type QwenSearchResponse = {
  evidences?: QwenEvidence[];
  sources?: QwenSource[];
  search_info?: {
    sources?: QwenSource[];
    results?: QwenSource[];
  };
  meta?: {
    sources?: QwenSource[];
  };
};

type QwenSource = {
  title?: string | null;
  url?: string | null;
  link?: string | null;
  snippet?: string | null;
  content?: string | null;
  published_at?: string | null;
  authority?: number | null;
};

const FALLBACK: QwenSearchResponse = { evidences: [] };

export async function qwenSearch(params: {
  claim: Claim;
  context?: string;
  facets?: string[];
  limit: number;
}): Promise<EvidenceCandidate[]> {
  const { claim, context, facets = [], limit } = params;
  if (!process.env.QWEN_API_KEY) return [];

  const system: ChatMessage = {
    role: 'system',
    content:
      '你是通义千问（Qwen Plus）联网事实核查助手。针对给定主张与上下文，主动检索最新可靠来源并输出 JSON {"evidences":[{"title":string,"url":string,"quote":string,"published_at":string|null,"authority":0-1}]}。URL 必须是可访问的 http/https 链接，quote 需为原文摘录，按可靠度与相关度排序。'
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

  const response = await callQwenJSON<QwenSearchResponse>([system, user], FALLBACK, {
    maxRetries: 2,
    extraBody: { enable_search: true, enable_source: true }
  });

  const fromSources = collectSources(response)
    .map((source) => evidenceFromSource(source))
    .filter((item): item is QwenEvidence => !!item);
  const fromModel = Array.isArray(response.evidences) ? response.evidences : [];
  const combined = fromSources.length ? [...fromSources, ...fromModel] : fromModel;
  if (!combined.length) {
    return [];
  }
  return combined.slice(0, limit).map(toEvidenceCandidate);
}

function collectSources(response: QwenSearchResponse): QwenSource[] {
  const buckets = [
    response.sources,
    response.search_info?.sources,
    response.search_info?.results,
    response.meta?.sources
  ];
  const flattened: QwenSource[] = [];
  buckets.forEach((bucket) => {
    if (Array.isArray(bucket)) {
      flattened.push(...bucket);
    }
  });
  if (!flattened.length) {
    // 某些场景下 Qwen 会把来源塞在 evidences 中，尝试从中兜底提取 URL
    return [];
  }
  return flattened;
}

function evidenceFromSource(source: QwenSource): QwenEvidence | null {
  const url = source.url?.trim() ?? source.link?.trim();
  if (!url) return null;
  return {
    title: source.title?.trim() || 'Untitled',
    url,
    quote: source.snippet?.trim() || source.content?.trim() || 'No snippet',
    published_at: source.published_at ?? null,
    authority: source.authority ?? null
  };
}

function toEvidenceCandidate(item: QwenEvidence): EvidenceCandidate {
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
