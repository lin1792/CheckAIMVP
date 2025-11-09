import { NextRequest, NextResponse } from 'next/server';
import { entailmentScore } from '@/lib/nli';
import { scoreVerification } from '@/lib/scoring';
import { VerifyRequestSchema, VerifyResponseSchema } from '@/lib/schemas';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const payload = VerifyRequestSchema.parse(json);
    const evidences = payload.evidences.slice(0, 5);
    const scored = await Promise.all(
      evidences.map(async (evidence) => ({
        evidence,
        score: await entailmentScore(payload.claim.text, evidence.quote || evidence.title)
      }))
    );

    const verification = scoreVerification(payload.claim.id, scored);
    const response = VerifyResponseSchema.parse([verification]);
    return NextResponse.json(response);
  } catch (error) {
    console.error('verify failed', error);
    return NextResponse.json({ error: '验证失败' }, { status: 500 });
  }
}
