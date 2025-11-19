'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { Claim, EvidenceCandidate, Verification } from '@/lib/schemas';
import { useEffect, useRef } from 'react';
import { useTranslation } from './LanguageProvider';
import type { TranslationKey } from '@/lib/i18n';

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
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [open, claim?.id]);
  return (
    <div
      className={clsx(
        'fixed right-0 top-16 md:top-20 bottom-0 z-40 w-full max-w-md transform bg-white shadow-2xl transition-transform',
        open ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div className="pr-4">
            <p className="text-xs uppercase text-slate-400">{t('drawer.title')}</p>
            <p className="text-sm font-semibold text-slate-800">
              {claim ? claim.text.slice(0, 80) : t('drawer.noClaim')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm whitespace-nowrap text-slate-500"
          >
            {t('drawer.close')}
          </button>
        </div>
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {verification ? (
            <section className="rounded-xl bg-slate-50 p-3 text-sm shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t('drawer.verdict')}
              </h3>
              <p className={clsx('mt-1 text-base font-bold', labelColor[verification.label])}>
                {t(`labels.${verification.label}` as TranslationKey)}
              </p>
              <p className="text-xs text-slate-500">
                {t('drawer.confidence', { value: Math.round(verification.confidence * 100) })}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">
                {renderReason(verification.reason, evidences, verification.citations)}
              </p>
            </section>
          ) : null}
          {evidences.length === 0 ? (
            <p className="text-sm text-slate-500">{t('drawer.noEvidence')}</p>
          ) : (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t('claims.evidenceCount', { count: evidences.length })}
              </h3>
              <ul className="space-y-3">
                {evidences.map((evidence, index) => (
                  <li
                    key={evidence.id}
                    className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm"
                  >
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                      <p>{t(`sources.${evidence.source}` as TranslationKey)}</p>
                      <span className="text-slate-500">#{index + 1}</span>
                    </div>
                    <a
                      href={evidence.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block font-semibold text-accent hover:underline"
                    >
                      {evidence.title}
                    </a>
                    <p className="mt-1 leading-relaxed text-slate-600">
                      {truncateQuote(evidence.quote)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {t('drawer.authority', { value: (evidence.authority * 100).toFixed(0) })}
                      {evidence.published_at ? ` · ${new Date(evidence.published_at).toLocaleDateString()}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function renderReason(reason: string, evidences: EvidenceCandidate[], citations?: string[]): ReactNode {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  const pattern = /\[ref_(\d+)\]/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(reason))) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      nodes.push(reason.slice(lastIndex, matchIndex));
    }
    const refNumber = Number(match[1]);
    const url = evidences[refNumber - 1]?.url ?? citations?.[refNumber - 1];
    if (url) {
      nodes.push(
        <a
          key={`${url}-${matchIndex}`}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-accent underline"
        >
          {`[证据${refNumber}]`}
        </a>
      );
    } else {
      nodes.push(match[0]);
    }
    lastIndex = matchIndex + match[0].length;
  }
  if (lastIndex < reason.length) {
    nodes.push(reason.slice(lastIndex));
  }
  return <>{nodes}</>;
}

function truncateQuote(text: string, maxLength = 220): string {
  if (!text) return '暂无可引用摘要';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
}
