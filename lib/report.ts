import type { Claim, Verification } from './schemas';

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

export function buildHtmlReport(
  claims: Claim[],
  verifications: Verification[],
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

      const citations = (verdict.citations ?? [])
        .map(
          (citation, idx) =>
            `<li>证据 ${idx + 1}：<a href="${escapeHtml(citation)}">${escapeHtml(citation)}</a></li>`
        )
        .join('');

      return `
        <section class="claim">
          <h3>${LABEL_EMOJI[verdict.label]} 陈述 #${index + 1}</h3>
          <blockquote>${escapeHtml(claim.text)}</blockquote>
          <p><strong>标签：</strong>${LABEL_TEXT[verdict.label]}</p>
          <p><strong>置信度：</strong>${(verdict.confidence * 100).toFixed(1)}%</p>
          <p><strong>理由：</strong>${escapeHtml(verdict.reason)}</p>
          ${citations ? `<ul class="citations">${citations}</ul>` : ''}
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
