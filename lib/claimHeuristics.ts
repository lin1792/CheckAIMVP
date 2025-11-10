import { ClaimSchema, type Claim } from './schemas';

export type L0Decision = 'ALLOW' | 'REVIEW' | 'REJECT';

export type L0Result = {
  decision: L0Decision;
  score: number;
  signals: string[];
};

const NUMERIC_REGEX = /(?:\d+[,.]?\d*%?)|(?:百分之\d+)/i;
const MONEY_REGEX = /(?:\d+(?:\.\d+)?)(?:亿美元|亿元|万亿元|万美元|元|美元|人民币|USD|RMB|¥)/i;
const ORDER_REGEX = /(排名|第[一二三四五六七八九十百千]|top\s?\d)/i;
const CHANGE_REGEX = /(增长|下降|同比|环比|增加|减少|提升|下滑|涨幅|跌幅)/i;
const EVENT_VERBS = /(宣布|发布|签署|举行|发生|达成|成立|获批|启动|完成)/i;
const LOCATION_REGEX = /(位于|坐落|来自|总部|设在|located)/i;
const TIME_REGEX = /((?:19|20)\d{2})|年|月|日|季度|周|星期|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/i;
const QUESTION_REGEX = /[?？]|^(是否|为什么)/;
const OPINION_REGEX = /(我认为|看来|觉得|希望|呼吁|应该|必须|建议)/i;
const URL_REGEX = /(https?:\/\/|www\.)/i;
const NON_SENTENCE_REGEX = /^[^A-Za-z\u4e00-\u9fa5]+$/;

export function evaluateSentence(text: string): L0Result {
  const clean = text.trim();
  let score = 0;
  const signals: string[] = [];
  if (!clean) {
    return { decision: 'REJECT', score: -5, signals: ['empty'] };
  }
  if (clean.length >= 20) {
    score += 1;
    signals.push('length');
  }
  if (URL_REGEX.test(clean)) {
    score -= 4;
    signals.push('url');
  }
  if (NUMERIC_REGEX.test(clean)) {
    score += 2;
    signals.push('numeric');
  }
  if (MONEY_REGEX.test(clean)) {
    score += 1;
    signals.push('money');
  }
  if (ORDER_REGEX.test(clean)) {
    score += 1;
    signals.push('order');
  }
  if (CHANGE_REGEX.test(clean)) {
    score += 1;
    signals.push('change');
  }
  if (EVENT_VERBS.test(clean)) {
    score += 1;
    signals.push('event');
  }
  if (LOCATION_REGEX.test(clean)) {
    score += 1;
    signals.push('location');
  }
  if (TIME_REGEX.test(clean)) {
    score += 1;
    signals.push('time');
  }
  if (QUESTION_REGEX.test(clean) || OPINION_REGEX.test(clean)) {
    score -= 2;
    signals.push('opinion');
  }
  const alphaCount = clean.match(/[A-Za-z\u4e00-\u9fa5]/g)?.length ?? 0;
  if (alphaCount < 4) {
    score -= 3;
    signals.push('non_sentence');
  }
  if (clean.length < 8) {
    score -= 1;
  }

  let decision: L0Decision;
  if (score >= 3) {
    decision = 'ALLOW';
  } else if (score <= 0) {
    decision = 'REJECT';
  } else {
    decision = 'REVIEW';
  }

  return { decision, score, signals };
}

function confidenceFromScore(score: number): number {
  const base = 0.6 + Math.min(score, 6) * 0.05;
  return Math.max(0.5, Math.min(0.95, Number(base.toFixed(2))));
}

export function buildHeuristicClaim(
  text: string,
  span: Claim['source_span'],
  score = 3
): Claim {
  const tokens = text
    .replace(/[。！？!?]/g, ' ')
    .split(/\s+|，|、|；|,/)
    .filter(Boolean);
  const subject = tokens[0] ?? '主体未知';
  const predicate = tokens.slice(1, 4).join(' ') || '提出主张';
  const normalized: Claim['normalized'] = {
    subject,
    predicate,
    object: text.trim() || subject
  };
  return ClaimSchema.parse({
    id: crypto.randomUUID(),
    text: text.trim(),
    normalized,
    checkworthy: true,
    confidence: confidenceFromScore(score),
    source_span: span
  });
}
