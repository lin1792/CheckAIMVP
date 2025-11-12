import { NextRequest, NextResponse } from 'next/server';
import { callQwenJSON } from '@/lib/qwen';
import {
  ClaimSchema,
  ClaimsRequestSchema,
  ClaimsResponseSchema,
  type Claim
} from '@/lib/schemas';
import { buildHeuristicClaim, evaluateSentence } from '@/lib/claimHeuristics';
import { generateFallbackQueries, sanitizeQueries } from '@/lib/searchQueries';

export const runtime = 'nodejs';

type QwenClaimsResponse = {
  claims: Claim[];
  uncertain_reason?: string | null;
};

type CandidateSentence = {
  text: string;
  source_span: Claim['source_span'];
  score: number;
  signals: string[];
};

const URL_PATTERN = /(https?:\/\/|www\.)/i;

function isValidClaimText(text: string): boolean {
  const clean = text?.trim() ?? '';
  if (!clean) return false;
  if (URL_PATTERN.test(clean)) return false;
  const alphaCount = clean.match(/[A-Za-z\u4e00-\u9fa5]/g)?.length ?? 0;
  return alphaCount >= 3;
}

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
      source_span,
      search_queries: generateFallbackQueries({ text, normalized })
    });
  });
}

function sanitizeClaims(rawClaims: unknown[], fallback: Claim[], context?: string): Claim[] {
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

    const aiQueries = Array.isArray((claim as any)?.search_queries)
      ? sanitizeQueries(((claim as any)?.search_queries ?? []) as string[])
      : [];
    const fallbackQueries = generateFallbackQueries(
      { text: coerceString(claim.text) ?? fallbackClaim.text, normalized },
      { context }
    );
    const searchQueries = aiQueries.length ? aiQueries : fallbackQueries;

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
      source_span: sourceSpan,
      search_queries: searchQueries
    };
  });
}

function ensureUniqueClaimIds(claims: Claim[]): Claim[] {
  const used = new Set<string>();
  return claims.map((claim) => {
    let id = coerceString(claim.id) ?? crypto.randomUUID();
    while (used.has(id)) {
      id = crypto.randomUUID();
    }
    used.add(id);
    return { ...claim, id };
  });
}

async function runDeepseekForCandidates(params: {
  mode: 'allow' | 'review';
  candidates: CandidateSentence[];
  context?: string;
  fallback: Claim[];
}): Promise<Claim[]> {
  const { mode, candidates, context, fallback } = params;
  if (!candidates.length) return [];
  const systemPrompt =
    mode === 'allow'
      ? '你是事实核查专家。以下句子由启发式规则标为“高概率事实”。请严谨核实：仅当句子包含可外部验证的客观陈述（有明确主体、谓词、宾语或量化信息）时才输出 Claim。任何比喻、修辞、观点、宣传口号或缺乏明确事实的句子必须跳过。'
      : '你是事实核查专家。以下句子存在歧义，需要你判断是否包含可外部验证的事实主张。只有在句子明确陈述可核查事实时才输出 Claim；否则跳过。';

  const prompt = [
    {
      role: 'system' as const,
      content: `${systemPrompt} 输出严格 JSON {"claims":[Claim,...],"uncertain_reason":string|null}。Claim 必须包含 id,text,normalized,checkworthy,confidence,source_span,search_queries。normalized 要给出 subject/predicate/object，缺失字段请省略。search_queries 是供搜索引擎使用的关键词数组，请给 2-3 条最能覆盖事实主体、发生时间、地点的查询词，避免无关修辞。候选中每条含 signals 数组：若 signals 含 "url"、"non_sentence" 或句子显然不是完整陈述，必须跳过。不得生成未在候选中的句子。`
    },
    {
      role: 'user' as const,
      content: JSON.stringify({
        context: context ?? null,
        candidates: candidates.map((item, idx) => ({
          id: idx + 1,
          text: item.text,
          source_span: item.source_span,
          score: item.score,
          signals: item.signals
        }))
      })
    }
  ];

  const response = await callQwenJSON<QwenClaimsResponse>(prompt, { claims: fallback }, {
    maxRetries: 2
  });
  const sanitized = sanitizeClaims(response.claims ?? [], fallback, context ?? undefined);
  const filtered = sanitized.filter((claim) => isValidClaimText(claim.text));
  if (filtered.length) {
    return ClaimsResponseSchema.parse(filtered);
  }
  const fallbackFiltered = fallback.filter((claim) => isValidClaimText(claim.text));
  return fallbackFiltered;
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const payload = ClaimsRequestSchema.parse(json);
    const pairs = payload.sentences.map((text, idx) => ({
      text,
      source_span: payload.mapping[idx] ?? { paragraphIndex: 0, sentenceIndex: idx }
    }));
    const context = payload.context ?? null;
    const evaluations = pairs.map((pair) => evaluateSentence(pair.text));
    const allowCandidates: CandidateSentence[] = [];
    const reviewCandidates: CandidateSentence[] = [];
    pairs.forEach((pair, idx) => {
      const evalResult = evaluations[idx];
      if (evalResult.decision === 'ALLOW') {
        allowCandidates.push({
          text: pair.text,
          source_span: pair.source_span,
          score: evalResult.score,
          signals: evalResult.signals
        });
      } else if (evalResult.decision === 'REVIEW') {
        reviewCandidates.push({
          text: pair.text,
          source_span: pair.source_span,
          score: evalResult.score,
          signals: evalResult.signals
        });
      }
    });

    const allowFallback = allowCandidates.map((candidate) =>
      buildHeuristicClaim(candidate.text, candidate.source_span, candidate.score)
    );
    const reviewFallback = reviewCandidates.map((candidate) =>
      buildHeuristicClaim(candidate.text, candidate.source_span, 2)
    );

    const allowClaims = await runDeepseekForCandidates({
      mode: 'allow',
      candidates: allowCandidates,
      context: context ?? undefined,
      fallback: allowFallback
    });
    const reviewClaims = await runDeepseekForCandidates({
      mode: 'review',
      candidates: reviewCandidates,
      context: context ?? undefined,
      fallback: reviewFallback
    });

    const combinedFiltered = [...allowClaims, ...reviewClaims].filter((claim) =>
      isValidClaimText(claim.text)
    );
    const combined = ensureUniqueClaimIds(combinedFiltered);
    const keyed = new Map<string, Claim>();
    combined.forEach((claim) => {
      const key = `${claim.source_span.paragraphIndex}-${claim.source_span.sentenceIndex}`;
      if (!keyed.has(key)) {
        keyed.set(key, claim);
      }
    });
    const claims = Array.from(keyed.values()).sort((a, b) => {
      if (a.source_span.paragraphIndex === b.source_span.paragraphIndex) {
        return a.source_span.sentenceIndex - b.source_span.sentenceIndex;
      }
      return a.source_span.paragraphIndex - b.source_span.paragraphIndex;
    });

    return NextResponse.json(claims);
  } catch (error) {
    console.error('claim extraction failed', error);
    return NextResponse.json({ error: '结构化抽取失败' }, { status: 500 });
  }
}
