import { NextRequest, NextResponse } from 'next/server';
import { VerifyRequestSchema, VerifyResponseSchema } from '@/lib/schemas';
import { deepseekVerify } from '@/lib/deepverify';
import { entailmentScore } from '@/lib/nli';
import { scoreVerification } from '@/lib/scoring';

export const runtime = 'nodejs';
const MAX_CONTEXT_LENGTH = 6000;

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const payload = VerifyRequestSchema.parse(json);
    const contextSnippet = payload.context?.slice(0, MAX_CONTEXT_LENGTH);
    const evidences = payload.evidences.slice(0, 6);

    const deepseekVerdict = await deepseekVerify({
      claim: payload.claim,
      evidences,
      context: contextSnippet
    });
    if (deepseekVerdict) {
      const response = VerifyResponseSchema.parse([deepseekVerdict]);
      return NextResponse.json(response);
    }

    const scored = await Promise.all(
      evidences.slice(0, 5).map(async (evidence) => ({
        evidence,
        score: await entailmentScore(
          payload.claim.text,
          evidence.quote || evidence.title,
          contextSnippet
        )
      }))
    );
    const fallback = scoreVerification(payload.claim.id, scored);
    const safe = VerifyResponseSchema.parse([fallback]);
    return NextResponse.json(safe);
  } catch (error) {
    console.error('verify failed', error);
    return NextResponse.json({ error: '验证失败' }, { status: 500 });
  }
}
