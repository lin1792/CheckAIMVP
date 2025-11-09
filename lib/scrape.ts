export async function fetchMainText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'CheckAI/0.1 (+https://example.com)' } });
    if (!res.ok) return null;
    const html = await res.text();
    return extractMainText(html);
  } catch {
    return null;
  }
}

export function extractMainText(html: string): string {
  // Remove noisy blocks
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<(header|footer|nav|aside)[\s\S]*?<\/\1>/gi, ' ');

  // Prefer article/main if present
  const pickFirst = (re: RegExp) => {
    const m = cleaned.match(re);
    return m && m[1] ? m[1] : '';
  };

  const candidates = [
    pickFirst(/<article[\s\S]*?>([\s\S]*?)<\/article>/i),
    pickFirst(/<main[\s\S]*?>([\s\S]*?)<\/main>/i),
    pickFirst(/<div[^>]*itemprop=["']articleBody["'][\s\S]*?>([\s\S]*?)<\/div>/i),
    pickFirst(/<div[^>]*id=["']content["'][\s\S]*?>([\s\S]*?)<\/div>/i),
    pickFirst(/<body[\s\S]*?>([\s\S]*?)<\/body>/i)
  ];
  const longest = candidates.reduce((a, b) => (b && b.length > a.length ? b : a), '');
  const text = longest || cleaned;
  // Strip remaining tags
  const plain = text.replace(/<[^>]+>/g, ' ');
  return normalizeText(plain);
}

export function pickBestSentences(claim: string, text: string, limit = 2): string[] {
  const sentences = text
    .split(/(?<=[.!?。！？])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.length < 400);
  const scored = sentences
    .map((s) => ({ s, score: overlap(claim, s) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.s);
  return scored;
}

function overlap(a: string, b: string): number {
  const at = a.toLowerCase().split(/\W+/).filter(Boolean);
  const bt = b.toLowerCase().split(/\W+/).filter(Boolean);
  const A = new Set(at);
  let inter = 0;
  for (const t of bt) if (A.has(t)) inter += 1;
  return inter / Math.max(1, Math.min(A.size, bt.length));
}

function normalizeText(t: string): string {
  return t.replace(/\s+/g, ' ').trim();
}
