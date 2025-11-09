'use client';

import type { Verification } from '@/lib/schemas';

type Props = {
  claimsCount: number;
  verifiedCount: number;
  stats: Record<Verification['label'], number>;
  onExport: () => Promise<void>;
  exporting: boolean;
};

export default function SummaryBar({ claimsCount, verifiedCount, stats, onExport, exporting }: Props) {
  const readyToExport = claimsCount > 0 && verifiedCount > 0;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
        <span>陈述：{claimsCount}</span>
        <span>已判定：{verifiedCount}</span>
        <span>支持：{stats.SUPPORTED ?? 0}</span>
        <span>驳斥：{stats.REFUTED ?? 0}</span>
        <span>争议：{stats.DISPUTED ?? 0}</span>
        <span>不足：{stats.INSUFFICIENT ?? 0}</span>
      </div>
      <button
        type="button"
        disabled={!readyToExport || exporting}
        onClick={onExport}
        className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {exporting ? '生成中...' : '导出 Markdown 报告'}
      </button>
    </div>
  );
}
