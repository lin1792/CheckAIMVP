import { EvidenceCandidateSchema, type EvidenceCandidate } from './schemas';

const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;

const DEFAULT_LIMIT = 5;

type SearchOptions = {
  limit?: number;
  provider?: 'google' | 'brave';
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

async function googleSearch(query: string, limit: number): Promise<EvidenceCandidate[]> {
  if (!GOOGLE_CSE_ID || !GOOGLE_API_KEY) return [];
  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', GOOGLE_API_KEY);
  url.searchParams.set('cx', GOOGLE_CSE_ID);
  url.searchParams.set('q', query);
  url.searchParams.set('num', String(limit));

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
    fetchers.push(() => googleSearch(claim, limit));
    fetchers.push(() => braveSearch(claim, limit));
  } else {
    fetchers.push(() => braveSearch(claim, limit));
    fetchers.push(() => googleSearch(claim, limit));
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

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error('Wikipedia search failed');
  }
  const data = await res.json();
  const pages = data.query?.search ?? [];
  return pages.map((page: any) => {
    const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/\s/g, '_'))}`;
    return buildCandidate({
      source: 'wikipedia',
      url: pageUrl,
      title: page.title,
      quote: page.snippet?.replace(/<[^>]+>/g, '') ?? '',
      authority: 0.8,
      published_at: page.timestamp
    });
  });
}

export async function searchWikidata(query: string, limit = DEFAULT_LIMIT): Promise<EvidenceCandidate[]> {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.searchParams.set('action', 'wbsearchentities');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');
  url.searchParams.set('type', 'item');
  url.searchParams.set('search', query);
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error('Wikidata search failed');
  }
  const data = await res.json();
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
