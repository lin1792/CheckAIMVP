import { callDeepseekJSON, type ChatMessage } from './deepseek';

export type ExpandOptions = {
  sitePrefs?: string[]; // e.g., ['wikipedia.org','who.int','reuters.com']
  freshness?: 'm3' | 'm6' | 'y1' | 'any';
  maxQueries?: number;
};

export async function expandQueries(claim: string, opts: ExpandOptions = {}): Promise<string[]> {
  const { sitePrefs = ['wikipedia.org'], freshness = 'any', maxQueries = 4 } = opts;
  const fallback = buildFallback(claim, sitePrefs).slice(0, maxQueries);

  // If DeepSeek key is not set, callDeepseekJSON will return fallback
  const system: ChatMessage = {
    role: 'system',
    content:
      '你是检索查询生成器。只输出 JSON 对象 {"queries": string[]}。针对给定主张，给出3-5个不同的搜索式，包含关键实体/谓词、必要时加 site: 限制与年份。不要任何解释。'
  };
  const user: ChatMessage = {
    role: 'user',
    content: JSON.stringify({ claim, site_prefs: sitePrefs, freshness })
  };
  const res = await callDeepseekJSON<{ queries: string[] }>([system, user], { queries: fallback });
  const queries = Array.isArray(res.queries) && res.queries.length ? res.queries : fallback;
  return dedupe(queries).slice(0, maxQueries);
}

function buildFallback(claim: string, sitePrefs: string[]): string[] {
  const base = claim.replace(/\s+/g, ' ').trim();
  const core = base.replace(/[“”"'`]/g, '');
  const parts = [core];
  sitePrefs.forEach((site) => parts.push(`${core} site:${site}`));
  // Add a looser variant
  parts.push(core.split(' ').slice(0, 8).join(' '));
  return dedupe(parts);
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));
}

