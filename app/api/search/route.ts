import { NextRequest, NextResponse } from 'next/server';
import { searchWeb, searchWikipedia, searchWikidata } from '@/lib/retrieval';
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
    if (sources.includes('web')) {
      tasks.push(searchWeb(payload.claim.text));
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

    const results = (await Promise.all(tasks)).flat();
    const deduped = Array.from(new Map(results.map((item) => [item.url, item])).values()).slice(0, 12);
    const safe = SearchResponseSchema.parse(deduped);
    return NextResponse.json(safe);
  } catch (error) {
    console.error('search failed', error);
    return NextResponse.json({ error: '检索失败' }, { status: 500 });
  }
}
