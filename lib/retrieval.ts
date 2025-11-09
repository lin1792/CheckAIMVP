import { EvidenceCandidateSchema, type EvidenceCandidate } from './schemas';
import { fetchMainText, pickBestSentences } from './scrape';
import { rankByClaimRelevance } from './ranking';

const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;

const DEFAULT_LIMIT = 5;

type SearchOptions = {
  limit?: number;
  provider?: 'google' | 'brave';
  freshness?: 'm3' | 'm6' | 'y1' | 'any';
  sitePrefs?: string[];
};

type Fetcher = () => Promise<EvidenceCandidate[]>;

async function withFallback(fetchers: Fetcher[]): Promise<EvidenceCandidate[]> {
  for (const fetcher of fetchers) {
    try {
      const results = await fetcher();
      if (results.length) {
        return results;
      }
    } catch (error) {
      console.warn('search fallback triggered', error);
    }
  }
  return [];
}

function buildCandidate(partial: Omit<EvidenceCandidate, 'id'>): EvidenceCandidate {
  return EvidenceCandidateSchema.parse({ ...partial, id: crypto.randomUUID() });
}

async function googleSearch(query: string, limit: number, freshness?: SearchOptions['freshness']): Promise<EvidenceCandidate[]> {
  if (!GOOGLE_CSE_ID || !GOOGLE_API_KEY) return [];
  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', GOOGLE_API_KEY);
  url.searchParams.set('cx', GOOGLE_CSE_ID);
  url.searchParams.set('q', query);
  url.searchParams.set('num', String(limit));
  if (freshness && freshness !== 'any') url.searchParams.set('dateRestrict', freshness);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Search failed: ${res.status}`);
  }
  const data = await res.json();
  const items = data.items ?? [];
  return items.map((item: any) =>
    buildCandidate({
      source: 'web',
      url: item.link,
      title: item.title ?? 'Untitled',
      quote: item.snippet ?? '',
      published_at: item.pagemap?.metatags?.[0]?.['article:published_time'],
      authority: 0.5
    })
  );
}

async function braveSearch(query: string, limit: number): Promise<EvidenceCandidate[]> {
  if (!BRAVE_API_KEY) return [];
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(limit));

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': BRAVE_API_KEY
    }
  });
  if (!res.ok) {
    throw new Error(`Brave search failed: ${res.status}`);
  }
  const data = await res.json();
  const web = data.web?.results ?? [];
  return web.map((item: any) =>
    buildCandidate({
      source: 'web',
      url: item.url,
      title: item.title ?? 'Untitled',
      quote: item.description ?? '',
      published_at: typeof item.age === 'string' ? item.age : undefined,
      authority: 0.45
    })
  );
}

export async function searchWeb(claim: string, options: SearchOptions = {}): Promise<EvidenceCandidate[]> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const provider = options.provider ?? (GOOGLE_CSE_ID && GOOGLE_API_KEY ? 'google' : 'brave');

  const fetchers: Fetcher[] = [];
  if (provider === 'google') {
    fetchers.push(() => googleSearch(claim, limit, options.freshness));
    fetchers.push(() => braveSearch(claim, limit));
  } else {
    fetchers.push(() => braveSearch(claim, limit));
    fetchers.push(() => googleSearch(claim, limit, options.freshness));
  }

  return withFallback(fetchers);
}

export async function searchWikipedia(query: string, limit = DEFAULT_LIMIT): Promise<EvidenceCandidate[]> {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('list', 'search');
  url.searchParams.set('format', 'json');
  url.searchParams.set('srsearch', query);
  url.searchParams.set('utf8', '1');
  url.searchParams.set('srlimit', String(limit));

  let data: any;
  try {
    const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!res.ok) {
      return [];
    }
    data = await res.json();
  } catch {
    return [];
  }
  const pages = data.query?.search ?? [];
  const results: EvidenceCandidate[] = [];
  for (const page of pages) {
    const title = page.title as string;
    const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s/g, '_'))}`;
    // Fetch extract for better quotes
    try {
      const eu = new URL('https://en.wikipedia.org/w/api.php');
      eu.searchParams.set('action', 'query');
      eu.searchParams.set('prop', 'extracts');
      eu.searchParams.set('format', 'json');
      eu.searchParams.set('explaintext', '1');
      eu.searchParams.set('exsentences', '3');
      eu.searchParams.set('redirects', '1');
      eu.searchParams.set('titles', title);
      const er = await fetch(eu.toString(), { next: { revalidate: 3600 } });
      const ej = await er.json();
      const pagesObj = ej.query?.pages ?? {};
      const firstKey = Object.keys(pagesObj)[0];
      const extract = firstKey ? pagesObj[firstKey]?.extract : '';
      results.push(
        buildCandidate({
          source: 'wikipedia',
          url: pageUrl,
          title,
          quote: (extract as string) || (page.snippet?.replace(/<[^>]+>/g, '') ?? ''),
          authority: 0.85,
          published_at: page.timestamp
        })
      );
    } catch {
      results.push(
        buildCandidate({
          source: 'wikipedia',
          url: pageUrl,
          title,
          quote: page.snippet?.replace(/<[^>]+>/g, '') ?? '',
          authority: 0.8,
          published_at: page.timestamp
        })
      );
    }
  }
  return results;
}

export async function searchWikidata(query: string, limit = DEFAULT_LIMIT): Promise<EvidenceCandidate[]> {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.searchParams.set('action', 'wbsearchentities');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');
  url.searchParams.set('type', 'item');
  url.searchParams.set('search', query);
  url.searchParams.set('limit', String(limit));

  let data: any;
  try {
    const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!res.ok) {
      return [];
    }
    data = await res.json();
  } catch {
    return [];
  }
  const results = data.search ?? [];
  return results.map((item: any) => {
    const url = `https://www.wikidata.org/wiki/${item.id}`;
    return buildCandidate({
      source: 'wikidata',
      url,
      title: item.label ?? item.id,
      quote: item.description ?? '',
      authority: 0.75
    });
  });
}

export async function enrichWebEvidence(
  claimText: string,
  evidences: EvidenceCandidate[],
  maxPages = 3
): Promise<EvidenceCandidate[]> {
  const head = evidences.slice(0, maxPages);
  const tail = evidences.slice(maxPages);
  const enriched = await Promise.all(
    head.map(async (e) => {
      const text = await fetchMainText(e.url);
      if (!text) return e;
      const picks = pickBestSentences(claimText, text, 2);
      if (!picks.length) return e;
      return { ...e, quote: picks.join(' ') };
    })
  );
  return [...enriched, ...tail];
}

export async function searchAcrossQueries(
  queries: string[],
  options: SearchOptions & { claimText: string }
): Promise<EvidenceCandidate[]> {
  const all: EvidenceCandidate[] = [];
  for (const q of queries) {
    // eslint-disable-next-line no-await-in-loop
    const items = await searchWeb(q, options);
    all.push(...items);
  }
  // Deduplicate by url
  const deduped = Array.from(new Map(all.map((i) => [i.url, i])).values());
  const ranked = rankByClaimRelevance(options.claimText, deduped, options.limit ?? DEFAULT_LIMIT);
  const enriched = await enrichWebEvidence(options.claimText, ranked, 3);
  return enriched;
}
