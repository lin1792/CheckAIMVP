import { NextRequest, NextResponse } from 'next/server';
import { deepseekSearch } from '@/lib/deepseekSearch';
import { buildNormalizedFacets } from '@/lib/claimContext';
import { SearchRequestSchema, SearchResponseSchema } from '@/lib/schemas';

export const runtime = 'nodejs';
const MAX_CONTEXT_LENGTH = 6000;

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const payload = SearchRequestSchema.parse(json);
    const contextSnippet = payload.context?.slice(0, MAX_CONTEXT_LENGTH);
    const facets = buildNormalizedFacets(payload.claim);

    const evidences = await deepseekSearch({
      claim: payload.claim,
      context: contextSnippet,
      facets,
      limit: payload.limit ?? 10
    });

    const safe = SearchResponseSchema.parse(evidences);
    return NextResponse.json(safe);
  } catch (error) {
    console.error('search failed', error);
    return NextResponse.json({ error: '检索失败' }, { status: 500 });
  }
}
