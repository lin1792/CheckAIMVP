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
    const location = coerceString((claim.normalized as any)?.location);
    if (location) (normalized as any).location = location;
    const event = coerceString((claim.normalized as any)?.event);
    if (event) (normalized as any).event = event;
    const entities = Array.isArray((claim.normalized as any)?.entities)
      ? ((claim.normalized as any).entities as unknown[])
          .map((e) => coerceString(e))
          .filter((s): s is string => !!s)
      : undefined;
    if (entities && entities.length) (normalized as any).entities = entities;
    const numbers = Array.isArray((claim.normalized as any)?.numbers)
      ? ((claim.normalized as any).numbers as any[])
          .map((n) => ({
            key: coerceString(n?.key),
            value: typeof n?.value === 'number' ? n.value : Number(n?.value),
            qualifier: coerceString(n?.qualifier) as any,
            unit: coerceString(n?.unit)
          }))
          .filter((n) => Number.isFinite(n.value))
      : undefined;
    if (numbers && numbers.length) (normalized as any).numbers = numbers as any;

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
        content: `你是事实核查专家。给你原文全文 context 和按顺序的句子列表。任务：找出所有可核查陈述（含组织属性、成立时间、地位、数量与比较级），并结构化输出。严格只输出 JSON 对象：{"claims":[Claim,...],"uncertain_reason":string|null}。Claim 字段必须包含 id,text,normalized,checkworthy,confidence,source_span；置信度 0-1。normalized 必须包含 subject/predicate/object；可选字段：time,unit,location,event,entities(string[]),numbers([{key?,value:number,qualifier?("AT_LEAST"|"AT_MOST"|"APPROX"|"GREATER"|"LESS"|"EQUAL"),unit?}]),qualifiers(string[])。字段缺失请用 null 或省略，不要输出除 JSON 外的任何文本。`
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
