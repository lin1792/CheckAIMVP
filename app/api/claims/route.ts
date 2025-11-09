import { NextRequest, NextResponse } from 'next/server';
import { callDeepseekJSON } from '@/lib/deepseek';
import {
  ClaimSchema,
  ClaimsRequestSchema,
  ClaimsResponseSchema,
  type Claim
} from '@/lib/schemas';

export const runtime = 'nodejs';

type DeepseekClaimsResponse = {
  claims: Claim[];
  uncertain_reason?: string | null;
};

function coerceString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

function fallbackClaims(sentences: string[], fallbackMapping: Claim['source_span'][]): Claim[] {
  return sentences.slice(0, 5).map((text, idx) => {
    const tokens = text.split(' ');
    const normalized = {
      subject: tokens[0] ?? '主体未知',
      predicate: tokens.slice(1, 4).join(' ') || '提出主张',
      object: text,
      time: 'unspecified'
    };
    const source_span = fallbackMapping[idx] ?? { paragraphIndex: 0, sentenceIndex: idx };
    return ClaimSchema.parse({
      id: crypto.randomUUID(),
      text,
      normalized,
      checkworthy: true,
      confidence: 0.4,
      source_span
    });
  });
}

function sanitizeClaims(rawClaims: unknown[], fallback: Claim[]): Claim[] {
  const safeFallback = fallback.length
    ? fallback
    : [
        ClaimSchema.parse({
          id: crypto.randomUUID(),
          text: '未提供陈述',
          normalized: {
            subject: '主体未知',
            predicate: '提出主张',
            object: '未提供陈述'
          },
          checkworthy: true,
          confidence: 0.4,
          source_span: { paragraphIndex: 0, sentenceIndex: 0 }
        })
      ];

  return rawClaims.map((rawClaim, idx) => {
    const claim = rawClaim as Partial<Claim> & {
      normalized?: Partial<Claim['normalized']>;
    };
    const fallbackClaim = safeFallback[idx % safeFallback.length];
    const normalized = {
      subject: coerceString(claim.normalized?.subject) ?? fallbackClaim.normalized.subject,
      predicate: coerceString(claim.normalized?.predicate) ?? fallbackClaim.normalized.predicate,
      object: coerceString(claim.normalized?.object) ?? fallbackClaim.normalized.object
    } as Claim['normalized'];

    const time = coerceString(claim.normalized?.time);
    if (time) normalized.time = time;
    const unit = coerceString(claim.normalized?.unit);
    if (unit) normalized.unit = unit;

    const sourceSpan =
      claim.source_span ?? fallbackClaim.source_span ?? { paragraphIndex: 0, sentenceIndex: idx };

    return {
      id: coerceString(claim.id) ?? crypto.randomUUID(),
      text: coerceString(claim.text) ?? fallbackClaim.text,
      normalized,
      checkworthy:
        typeof claim.checkworthy === 'boolean' ? claim.checkworthy : fallbackClaim.checkworthy,
      confidence:
        typeof claim.confidence === 'number'
          ? Math.min(Math.max(claim.confidence, 0), 1)
          : fallbackClaim.confidence,
      source_span: sourceSpan
    };
  });
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const payload = ClaimsRequestSchema.parse(json);
    const pairs = payload.sentences.map((text, idx) => ({
      text,
      source_span: payload.mapping[idx] ?? { paragraphIndex: 0, sentenceIndex: idx }
    }));

    const fallback = { claims: fallbackClaims(payload.sentences, payload.mapping) };

    const prompt = [
      {
        role: 'system' as const,
        content:
          '你是事实核查专家。收到句子列表后，找出可核查陈述。仅输出 JSON: {"claims":[Claim,...],"uncertain_reason":string|null}。Claim 字段必须包含 id,text,normalized,checkworthy,confidence,source_span。置信度 0-1，normalized 含 subject/predicate/object/time, unit 可选。'
      },
      {
        role: 'user' as const,
        content: JSON.stringify({ sentences: pairs, context: payload.context ?? null })
      }
    ];

    const response = await callDeepseekJSON<DeepseekClaimsResponse>(prompt, fallback, { maxRetries: 2 });
    const sanitized = sanitizeClaims(response.claims ?? [], fallback.claims);
    const claims = sanitized.length ? ClaimsResponseSchema.parse(sanitized) : fallback.claims;

    if (claims.length < 5 && fallback.claims.length >= 5) {
      claims.push(...fallback.claims.slice(claims.length, 5));
    }

    return NextResponse.json(claims);
  } catch (error) {
    console.error('claim extraction failed', error);
    return NextResponse.json({ error: '结构化抽取失败' }, { status: 500 });
  }
}
