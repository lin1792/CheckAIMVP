'use client';

import clsx from 'clsx';
import type { Claim, EvidenceCandidate, Verification } from '@/lib/schemas';

type Props = {
  open: boolean;
  claim: Claim | null;
  evidences: EvidenceCandidate[];
  verification?: Verification;
  onClose: () => void;
};

const labelColor: Record<Verification['label'], string> = {
  SUPPORTED: 'text-green-600',
  REFUTED: 'text-red-600',
  DISPUTED: 'text-amber-600',
  INSUFFICIENT: 'text-slate-500'
};

export default function EvidenceDrawer({ open, claim, evidences, verification, onClose }: Props) {
  return (
    <div
      className={clsx(
        'fixed inset-y-0 right-0 z-40 w-full max-w-md transform bg-white shadow-2xl transition-transform',
        open ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      <div className="flex items-center justify-between border-b border-slate-100 p-4">
        <div>
          <p className="text-xs uppercase text-slate-400">证据抽屉</p>
          <p className="text-sm font-semibold text-slate-800">
            {claim ? claim.text.slice(0, 80) : '未选中陈述'}
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-slate-500">
          关闭
        </button>
      </div>
      <div className="h-[calc(100%-64px)] overflow-y-auto p-4">
        {verification ? (
          <div className="mb-4 rounded-xl bg-slate-50 p-3 text-sm">
            <p className="font-semibold text-slate-700">判定</p>
            <p className={clsx('mt-1 text-base font-bold', labelColor[verification.label])}>{verification.label}</p>
            <p className="text-xs text-slate-500">置信度 {Math.round(verification.confidence * 100)}%</p>
            <p className="mt-2 text-sm text-slate-600">{verification.reason}</p>
          </div>
        ) : null}
        {evidences.length === 0 ? (
          <p className="text-sm text-slate-500">暂无证据，请稍候...</p>
        ) : (
          <ul className="space-y-3">
            {evidences.map((evidence) => (
              <li key={evidence.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-slate-400">{evidence.source}</p>
                <a
                  href={evidence.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block font-semibold text-accent"
                >
                  {evidence.title}
                </a>
                <p className="mt-1 text-slate-600">{evidence.quote}</p>
                <p className="mt-1 text-xs text-slate-400">
                  权威度 {(evidence.authority * 100).toFixed(0)}%
                  {evidence.published_at ? ` · ${new Date(evidence.published_at).toLocaleDateString()}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
