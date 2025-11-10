import type { Claim } from './schemas';

const DEFAULT_MAX_CONTEXT = 600;

export function buildNormalizedFacets(claim: Claim): string[] {
  const { normalized } = claim;
  const numbers = (normalized.numbers ?? []).map((n) =>
    n.unit ? `${n.value} ${n.unit}` : String(n.value)
  );
  const facets = [
    normalized.subject,
    normalized.object,
    normalized.predicate,
    normalized.location,
    normalized.time,
    normalized.event,
    ...(normalized.entities ?? []),
    ...(normalized.qualifiers ?? []),
    ...numbers
  ];
  return dedupeStrings(facets);
}

export function extractContextTokens(context?: string, maxLength = DEFAULT_MAX_CONTEXT): string[] {
  if (!context) return [];
  const trimmed = context.replace(/\s+/g, ' ').trim().slice(0, maxLength);
  const years = Array.from(new Set(trimmed.match(/\b(19|20)\d{2}\b/g) ?? []));
  const zhPhrases = Array.from(new Set(trimmed.match(/[\u4e00-\u9fa5]{2,6}/g) ?? [])).slice(0, 4);
  const tokens = trimmed
    .split(/[\s,.;:()\[\]{}“”"、]+/)
    .map((t) => t.trim())
    .filter((t) => /^[A-Za-z][A-Za-z-]{2,}$/.test(t))
    .slice(0, 6);
  return dedupeStrings([...years, ...zhPhrases, ...tokens]);
}

export function buildHeuristicQueries(
  claimText: string,
  facets: string[],
  context?: string
): string[] {
  const pool = dedupeStrings([...facets, ...extractContextTokens(context)]);
  const base = `${claimText} ${pool.slice(0, 3).join(' ')}`.trim();
  const secondary =
    pool.length > 3 ? `${claimText} ${pool.slice(3, 6).join(' ')}`.trim() : base;
  const focused = pool.length
    ? `${claimText} ${pool[0]} ${pool[1] ?? ''}`.trim()
    : claimText;
  return dedupeStrings([claimText, base, secondary, focused]);
}

export function dedupeStrings(list: (string | undefined)[]): string[] {
  return Array.from(
    new Set(
      list
        .map((item) => (item ?? '').trim())
        .filter((item) => item.length > 1)
    )
  );
}

