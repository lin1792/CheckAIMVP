function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2)
  );
}

export function overlapScore(a: string, b: string): number {
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
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

