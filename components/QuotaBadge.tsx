'use client';

type Props = {
  used: number;
  limit: number;
  loading?: boolean;
};

export default function QuotaBadge({ used, limit, loading }: Props) {
  const remaining = Math.max(limit - used, 0);
  const pct = Math.max(0, Math.min(100, Math.round((used / Math.max(limit, 1)) * 100)));
  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs text-slate-700 shadow-sm">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      {loading ? '加载中…' : `剩余 ${remaining} / ${limit}`}
    </div>
  );
}

