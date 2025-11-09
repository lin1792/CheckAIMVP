import type { Claim, Verification } from './schemas';

const LABEL_EMOJI: Record<Verification['label'], string> = {
  SUPPORTED: '✅',
  REFUTED: '❌',
  DISPUTED: '⚖️',
  INSUFFICIENT: '⚪️'
};

export function buildMarkdownReport(
  claims: Claim[],
  verifications: Verification[],
  generatedAt = new Date().toISOString()
): string {
  const lines: string[] = [];
  lines.push(`# CheckAI Fact-Check Report`);
  lines.push(`_生成时间：${new Date(generatedAt).toLocaleString()}_`);

  const counts = verifications.reduce(
    (acc, item) => {
      acc[item.label] += 1;
      return acc;
    },
    { SUPPORTED: 0, REFUTED: 0, DISPUTED: 0, INSUFFICIENT: 0 }
  );

  lines.push('## 汇总');
  lines.push(
    `- 支持：${counts.SUPPORTED} 条\n- 驳斥：${counts.REFUTED} 条\n- 存争议：${counts.DISPUTED} 条\n- 证据不足：${counts.INSUFFICIENT} 条`
  );

  lines.push('## 详细结论');
  claims.forEach((claim) => {
    const verdict = verifications.find((v) => v.claimId === claim.id);
    if (!verdict) return;
    lines.push(`### ${LABEL_EMOJI[verdict.label]} 陈述 #${claim.id}`);
    lines.push(`> ${claim.text}`);
    lines.push(`- 标签：**${verdict.label}**`);
    lines.push(`- 置信度：${(verdict.confidence * 100).toFixed(1)}%`);
    lines.push(`- 理由：${verdict.reason}`);
    if (verdict.citations.length) {
      lines.push('#### 引用');
      verdict.citations.forEach((citation, idx) => {
        lines.push(`${idx + 1}. [证据链接](${citation})`);
      });
    }
  });

  return lines.join('\n\n');
}
