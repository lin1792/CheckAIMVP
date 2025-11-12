import type { Claim } from './schemas';

const MAX_CONTEXT_SNIPPET = 120;

export function generateFallbackQueries(claim: Pick<Claim, 'text' | 'normalized'>, options?: {
  context?: string;
  facets?: string[];
}): string[] {
  const base = sanitizeText(claim.text);
  const pieces = new Set<string>();
  if (base) pieces.add(base);

  const subject = sanitizeText(claim.normalized?.subject ?? '');
  const object = sanitizeText(claim.normalized?.object ?? '');
  const predicate = sanitizeText(claim.normalized?.predicate ?? '');
  const time = sanitizeText(claim.normalized?.time ?? '');

  const combo1 = [object, subject, predicate].filter(Boolean).join(' ').trim();
  if (combo1) pieces.add(combo1);

  if (object && time) {
    pieces.add(`${object} ${predicate} ${time}`.trim());
  }

  if (options?.context) {
    const snippet = options.context.split(/\n+/)[0]?.slice(0, MAX_CONTEXT_SNIPPET) ?? '';
    const contextual = `${object || subject || ''} ${sanitizeText(snippet)}`.trim();
    if (contextual) pieces.add(contextual);
  }

  if (options?.facets?.length) {
    const facetQuery = options.facets.map((f) => sanitizeText(f)).filter(Boolean).join(' ');
    if (facetQuery) pieces.add(facetQuery);
  }

  return Array.from(pieces).filter(Boolean);
}

export function sanitizeQueries(queries: string[]): string[] {
  return Array.from(
    new Set(
      queries
        .map((q) => sanitizeText(q))
        .filter((q) => q.length >= 3)
    )
  );
}

function sanitizeText(text: string): string {
  return (text ?? '').replace(/[“”"'<>]/g, '').replace(/\s+/g, ' ').trim();
}
