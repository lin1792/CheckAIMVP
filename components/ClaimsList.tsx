'use client';

import clsx from 'clsx';
import type { Claim, EvidenceCandidate, Verification } from '@/lib/schemas';

type Props = {
  claims: Claim[];
  verifications: Record<string, Verification>;
  evidences: Record<string, EvidenceCandidate[]>;
  filters: Verification['label'][];
  loading: boolean;
  onSelectClaim: (claimId: string) => void;
  selectedClaimId: string | null;
};

const labelText: Record<Verification['label'], string> = {
  SUPPORTED: '支持',
  REFUTED: '驳斥',
  DISPUTED: '存争议',
  INSUFFICIENT: '证据不足'
};

export default function ClaimsList({
  claims,
  verifications,
  evidences,
  filters,
  loading,
  onSelectClaim,
  selectedClaimId
}: Props) {
  const filtered = claims.filter((claim) => {
    const verdict = verifications[claim.id];
    if (!filters.length || !verdict) {
      return true;
    }
    return filters.includes(verdict.label);
  });

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div key={`skeleton-${idx}`} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (!filtered.length) {
    return <p className="text-sm text-slate-500">暂无可核查陈述</p>;
  }

  return (
    <div className="space-y-3">
      {filtered.map((claim) => {
        const verdict = verifications[claim.id];
        const badge = verdict ? labelText[verdict.label] : '待验证';
        const badgeClass = verdict
          ? {
              SUPPORTED: 'bg-green-50 text-green-700',
              REFUTED: 'bg-red-50 text-red-700',
              DISPUTED: 'bg-yellow-50 text-yellow-700',
              INSUFFICIENT: 'bg-slate-50 text-slate-600'
            }[verdict.label]
          : 'bg-blue-50 text-blue-600';
        return (
          <button
            key={claim.id}
            type="button"
            onClick={() => onSelectClaim(claim.id)}
            className={clsx(
              'w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-accent',
              selectedClaimId === claim.id && 'border-accent ring-2 ring-accent/30'
            )}
          >
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-700">#{claim.source_span.paragraphIndex + 1}.{claim.source_span.sentenceIndex + 1}</span>
              <span className={clsx('rounded-full px-3 py-0.5 text-xs font-medium', badgeClass)}>{badge}</span>
            </div>
            <p className="mt-2 text-slate-800">{claim.text}</p>
            <p className="mt-2 text-xs text-slate-500">
              证据 {evidences[claim.id]?.length ?? 0} 条 · 置信度
              {verdict ? ` ${(verdict.confidence * 100).toFixed(0)}%` : ' 采集中'}
            </p>
          </button>
        );
      })}
    </div>
  );
}
