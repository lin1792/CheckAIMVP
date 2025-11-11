function tokenize(text: string): Set<string> {
  const sanitized = text
    .toLowerCase()
    .replace(/[^A-Za-z0-9\u00C0-\uFFFF\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  return new Set(sanitized);
}

export function overlapScore(a: string, b: string): number {
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  A.forEach((token) => {
    if (B.has(token)) inter += 1;
  });
  return inter / Math.min(A.size, B.size);
}

export function rankByClaimRelevance<T extends { title?: string; quote?: string }>(
  claimText: string,
  items: T[],
  pick = 10
): T[] {
  const scored = items.map((it) => {
    const text = `${it.title ?? ''} ${it.quote ?? ''}`.trim();
    return { it, score: overlapScore(claimText, text) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, pick).map((x) => x.it);
}
