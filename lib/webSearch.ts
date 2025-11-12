import type { Claim, EvidenceCandidate } from './schemas';
import { generateFallbackQueries, sanitizeQueries } from './searchQueries';

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const SERPER_LOCATION = process.env.SERPER_LOCATION ?? 'us';
const SERPER_LANGUAGE = process.env.SERPER_LANGUAGE ?? 'en';

const PREFERRED_DOMAINS = [
  'wikipedia.org',
  'wikidata.org',
  'reuters.com',
  'apnews.com',
  'bbc.com',
  'nytimes.com',
  'un.org',
  'who.int',
  'worldbank.org',
  'imf.org'
];

const DOMAIN_BLOCKLIST = ['baidu.com', 'baijiahao.baidu.com', 'toutiao.com'];

const reachabilityCache = new Map<string, boolean>();

export async function webSearch(params: {
  claim: Claim;
  context?: string;
  facets?: string[];
  limit: number;
}): Promise<EvidenceCandidate[]> {
  if (!SERPER_API_KEY) return [];
  const { claim, context, facets, limit } = params;
  const aiQueries = sanitizeQueries(claim.search_queries ?? []);
  const fallbackQueries = generateFallbackQueries(claim, { context, facets });
  const queries = (aiQueries.length ? aiQueries : fallbackQueries).filter((q) => q.length > 0);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[serper] queries', { claimId: claim.id, queries });
  }

  const collected: EvidenceCandidate[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    if (collected.length >= limit) break;
    // eslint-disable-next-line no-await-in-loop
    const organic = await callSerper(query);
    for (const item of organic) {
      if (collected.length >= limit) break;
      const url = item.link?.trim() ?? item.url?.trim();
      if (!url || seen.has(url)) continue;
      // eslint-disable-next-line no-await-in-loop
      const reachable = await isUrlReachable(url);
      if (!reachable) continue;
      seen.add(url);
      collected.push(mapSerperResult(item));
    }
  }

  return collected.slice(0, limit);
}

async function callSerper(query: string) {
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': SERPER_API_KEY!
      },
      body: JSON.stringify({ q: query, gl: SERPER_LOCATION, hl: SERPER_LANGUAGE, num: 10 })
    });
    if (!res.ok) {
      console.warn('Serper search failed', res.status, await res.text());
      return [];
    }
    const data = (await res.json()) as SerperResponse;
    return data.organic ?? [];
  } catch (error) {
    console.error('Serper search error', error);
    return [];
  }
}

function mapSerperResult(item: SerperOrganicResult): EvidenceCandidate {
  const url = item.link ?? item.url ?? '';
  return {
    id: crypto.randomUUID(),
    source: inferSource(url),
    url,
    title: item.title || 'Untitled',
    quote: item.snippet || item.description || 'No snippet',
    published_at: item.date ?? item.publishedTime ?? undefined,
    authority: clampAuthority(scoreDomain(url))
  };
}

function inferSource(url: string): EvidenceCandidate['source'] {
  if (url.includes('wikipedia.org')) return 'wikipedia';
  if (url.includes('wikidata.org')) return 'wikidata';
  return 'web';
}

function scoreDomain(url: string): number {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (DOMAIN_BLOCKLIST.some((blocked) => hostname.includes(blocked))) return 0.2;
    if (PREFERRED_DOMAINS.some((domain) => hostname.endsWith(domain))) return 0.95;
    if (hostname.endsWith('.gov') || hostname.includes('.gov.')) return 0.9;
    if (hostname.endsWith('.edu') || hostname.includes('.edu.')) return 0.85;
    if (hostname.endsWith('.org')) return 0.75;
  } catch {
    return 0.5;
  }
  return 0.6;
}

function clampAuthority(value: number): number {
  return Math.max(0.2, Math.min(0.95, Number(value.toFixed(2))));
}

async function isUrlReachable(url: string): Promise<boolean> {
  if (reachabilityCache.has(url)) {
    return reachabilityCache.get(url)!;
  }
  const result = await tryFetch(url, 'HEAD');
  if (result) {
    reachabilityCache.set(url, true);
    return true;
  }
  const fallback = await tryFetch(url, 'GET');
  reachabilityCache.set(url, fallback);
  return fallback;
}

async function tryFetch(url: string, method: 'HEAD' | 'GET'): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(url, { method, signal: controller.signal, redirect: 'follow' });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

type SerperResponse = {
  organic?: SerperOrganicResult[];
};

type SerperOrganicResult = {
  title?: string;
  link?: string;
  url?: string;
  snippet?: string;
  description?: string;
  date?: string;
  publishedTime?: string;
};
