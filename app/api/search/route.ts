import { NextRequest, NextResponse } from 'next/server';
import { searchAcrossQueries, searchWikipedia, searchWikidata } from '@/lib/retrieval';
import { expandQueries } from '@/lib/expand';
import {
  SearchRequestSchema,
  SearchResponseSchema,
  type EvidenceCandidate
} from '@/lib/schemas';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const payload = SearchRequestSchema.parse(json);
    const sources = payload.sources ?? ['web', 'wikipedia'];
    const tasks: Promise<EvidenceCandidate[]>[] = [];

    let queries: string[] = [payload.claim.text];
    if (payload.llm_expand) {
      queries = await expandQueries(payload.claim.text, {
        sitePrefs: payload.site_prefs,
        freshness: payload.freshness ?? 'any',
        maxQueries: 4
      });
    }

    if (sources.includes('web')) {
      tasks.push(
        searchAcrossQueries(queries, {
          claimText: payload.claim.text,
          limit: payload.limit ?? 10,
          freshness: payload.freshness ?? 'any'
        })
      );
    }
    if (sources.includes('wikipedia')) {
      tasks.push(searchWikipedia(payload.claim.text));
    }
    if (sources.includes('wikidata')) {
      tasks.push(searchWikidata(payload.claim.text));
    }

    if (tasks.length === 0) {
      return NextResponse.json({ error: '未选择检索渠道' }, { status: 400 });
    }

    const settled = await Promise.allSettled(tasks);
    const results = settled
      .filter((s): s is PromiseFulfilledResult<EvidenceCandidate[]> => s.status === 'fulfilled')
      .flatMap((s) => s.value);
    if (!results.length) {
      // Return empty list instead of 500 to avoid breaking UI under restricted network
      return NextResponse.json([]);
    }
    const deduped = Array.from(new Map(results.map((item) => [item.url, item])).values()).slice(0, 12);
    const safe = SearchResponseSchema.parse(deduped);
    return NextResponse.json(safe);
  } catch (error) {
    console.error('search failed', error);
    return NextResponse.json({ error: '检索失败' }, { status: 500 });
  }
}
