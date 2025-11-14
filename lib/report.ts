import type { Claim, EvidenceCandidate, Verification } from './schemas';

const LABEL_EMOJI: Record<Verification['label'], string> = {
  SUPPORTED: '✅',
  REFUTED: '❌',
  DISPUTED: '⚖️',
  INSUFFICIENT: '⚪️'
};

const LABEL_TEXT: Record<Verification['label'], string> = {
  SUPPORTED: '支持',
  REFUTED: '驳斥',
  DISPUTED: '存争议',
  INSUFFICIENT: '证据不足'
};

const SOURCE_LABEL: Record<EvidenceCandidate['source'], string> = {
  web: '网页',
  wikipedia: '维基百科',
  wikidata: 'Wikidata'
};

export function buildHtmlReport(
  claims: Claim[],
  verifications: Verification[],
  evidenceMap: Record<string, EvidenceCandidate[]> = {},
  generatedAt = new Date().toISOString()
): string {
  const generatedDate = new Date(generatedAt ?? new Date().toISOString());
  const safeGeneratedAt = Number.isNaN(generatedDate.getTime())
    ? new Date().toLocaleString()
    : generatedDate.toLocaleString();

  const counts = verifications.reduce(
    (acc, item) => {
      acc[item.label] += 1;
      return acc;
    },
    { SUPPORTED: 0, REFUTED: 0, DISPUTED: 0, INSUFFICIENT: 0 }
  );

  const detailSections = claims
    .map((claim, index) => {
      const verdict = verifications.find((v) => v.claimId === claim.id);
      if (!verdict) return '';
      const evidences = evidenceMap[claim.id] ?? [];
      const citations = verdict.citations ?? [];
      const reasonHtml = renderReasonHtml(verdict.reason, evidences, citations);
      const evidenceBlock = buildEvidenceListHtml(evidences, citations);

      return `
        <section class="claim">
          <h3>${LABEL_EMOJI[verdict.label]} 陈述 #${index + 1}</h3>
          <blockquote>${escapeHtml(claim.text)}</blockquote>
          <p><strong>标签：</strong>${LABEL_TEXT[verdict.label]}</p>
          <p><strong>置信度：</strong>${(verdict.confidence * 100).toFixed(1)}%</p>
          <p><strong>理由：</strong><span class="verdict-reason">${reasonHtml}</span></p>
          ${evidenceBlock}
        </section>
      `;
    })
    .filter(Boolean)
    .join('\n');

  return `<!DOCTYPE html>
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8" />
      <title>CheckAI Fact-Check Report</title>
      <style>
        body { font-family: 'Microsoft YaHei', 'PingFang SC', Arial, sans-serif; margin: 32px; color: #0f172a; line-height: 1.6; }
        h1 { font-size: 28px; margin-bottom: 4px; }
        h2 { border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 32px; }
        .summary-list { list-style: none; padding: 0; }
        .summary-list li { margin: 4px 0; }
        .claim { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-top: 24px; }
        blockquote { margin: 12px 0; padding-left: 12px; border-left: 3px solid #94a3b8; color: #475569; }
        ul.citations { margin-top: 12px; padding-left: 18px; }
        ul.citations li { margin-bottom: 6px; }
        .evidence-list { padding-left: 20px; }
        .evidence-card { margin-bottom: 12px; }
        .evidence-card h4 { margin: 4px 0; font-size: 15px; }
        .evidence-meta { font-size: 12px; color: #64748b; }
        .verdict-reason a { color: #2563eb; text-decoration: underline; }
        a { color: #2563eb; }
      </style>
    </head>
    <body>
      <h1>CheckAI Fact-Check Report</h1>
      <p>生成时间：${safeGeneratedAt}</p>
      <h2>汇总</h2>
      <ul class="summary-list">
        <li>支持：${counts.SUPPORTED} 条</li>
        <li>驳斥：${counts.REFUTED} 条</li>
        <li>存争议：${counts.DISPUTED} 条</li>
        <li>证据不足：${counts.INSUFFICIENT} 条</li>
      </ul>
      <h2>详细结论</h2>
      ${detailSections}
    </body>
  </html>`;
}

function escapeHtml(text: string): string {
  return (text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeWithBreaks(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br />');
}

function renderReasonHtml(
  reason: string,
  evidences: EvidenceCandidate[],
  citations: string[]
): string {
  const safeReason = reason ?? '';
  if (!safeReason.trim()) {
    return '未提供理由';
  }
  const pattern = /\[ref_(\d+)\]/gi;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(safeReason))) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      result += escapeWithBreaks(safeReason.slice(lastIndex, start));
    }
    const refNumber = Number(match[1]);
    const url = getReferenceUrl(evidences, citations, refNumber);
    if (url) {
      result += `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">[证据${refNumber}]</a>`;
    } else {
      result += escapeHtml(match[0]);
    }
    lastIndex = start + match[0].length;
  }
  if (lastIndex < safeReason.length) {
    result += escapeWithBreaks(safeReason.slice(lastIndex));
  }
  return result || '未提供理由';
}

function getReferenceUrl(
  evidences: EvidenceCandidate[],
  citations: string[],
  refNumber: number
): string | null {
  if (!Number.isFinite(refNumber) || refNumber <= 0) return null;
  const idx = refNumber - 1;
  if (evidences[idx]?.url) {
    return evidences[idx].url;
  }
  if (citations[idx]) {
    return citations[idx];
  }
  return null;
}

function buildEvidenceListHtml(
  evidences: EvidenceCandidate[],
  fallbackCitations: string[]
): string {
  if (evidences.length === 0) {
    if (!fallbackCitations.length) return '';
    const items = fallbackCitations
      .map(
        (citation, idx) =>
          `<li>证据 ${idx + 1}：<a href="${escapeHtml(citation)}">${escapeHtml(citation)}</a></li>`
      )
      .join('');
    return `<ul class="citations">${items}</ul>`;
  }
  const cards = evidences
    .map((evidence, idx) => {
      const authority = Math.round((evidence.authority ?? 0) * 100);
      const published = evidence.published_at
        ? new Date(evidence.published_at).toLocaleDateString()
        : '';
      return `<li class="evidence-card">
        <div class="evidence-meta">证据 ${idx + 1} · ${SOURCE_LABEL[evidence.source] ?? evidence.source}</div>
        <h4><a href="${escapeHtml(evidence.url)}" target="_blank" rel="noreferrer">${escapeHtml(
          evidence.title || '未命名来源'
        )}</a></h4>
        <p>${escapeHtml(evidence.quote || '暂无摘录')}</p>
        <p class="evidence-meta">权威度：${authority}%${
          published ? ` · 发布于 ${escapeHtml(published)}` : ''
        }</p>
      </li>`;
    })
    .join('');
  return `<section>
    <h4>证据列表</h4>
    <ol class="evidence-list">
      ${cards}
    </ol>
  </section>`;
}
