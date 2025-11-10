'use client';

import clsx from 'clsx';
import type { Claim, ParsedDocument, Verification } from '@/lib/schemas';
import { useTranslation } from './LanguageProvider';

type Props = {
  document: ParsedDocument | null;
  claims: Claim[];
  verifications: Record<string, Verification>;
  selectedClaimId: string | null;
  onSelectClaim: (claimId: string) => void;
};

type SentencePart = {
  paragraphIndex: number;
  sentenceIndex: number;
  text: string;
  claims: Claim[];
};

const labelClasses: Record<Verification['label'], string> = {
  SUPPORTED: 'bg-green-100 text-green-800',
  REFUTED: 'bg-red-100 text-red-800',
  DISPUTED: 'bg-yellow-100 text-yellow-800',
  INSUFFICIENT: 'bg-slate-100 text-slate-800'
};

const fallbackClass = 'bg-blue-100 text-blue-800';

export default function DocPreview({
  document,
  claims,
  verifications,
  selectedClaimId,
  onSelectClaim
}: Props) {
  const { t } = useTranslation();
  if (!document) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-500">
        {t('docPreview.empty')}
      </div>
    );
  }

  const locationMap = new Map<string, Claim[]>();
  claims.forEach((claim) => {
    const key = `${claim.source_span.paragraphIndex}-${claim.source_span.sentenceIndex}`;
    const list = locationMap.get(key) ?? [];
    list.push(claim);
    locationMap.set(key, list);
  });

  const buckets: SentencePart[][] = document.paragraphs.map(() => []);
  document.mapping.forEach((span, idx) => {
    if (!buckets[span.paragraphIndex]) return;
    buckets[span.paragraphIndex].push({
      paragraphIndex: span.paragraphIndex,
      sentenceIndex: span.sentenceIndex,
      text: document.sentences[idx] ?? '',
      claims: locationMap.get(`${span.paragraphIndex}-${span.sentenceIndex}`) ?? []
    });
  });
  buckets.forEach((bucket) => bucket.sort((a, b) => a.sentenceIndex - b.sentenceIndex));

  return (
    <div className="h-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-inner">
      {document.paragraphs.map((paragraph, idx) => (
        <div key={`paragraph-${idx}`} className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('docPreview.paragraph', { index: idx + 1 })}
          </p>
          <p className="mt-2 leading-relaxed text-slate-800">
            {(buckets[idx] ?? []).length === 0
              ? paragraph
              : buckets[idx].map((part, partIndex) => {
                  if (!part.claims.length) {
                    return (
                      <span key={`paragraph-${idx}-part-${partIndex}`}>{part.text} </span>
                    );
                  }
                  return (
                    <span key={`paragraph-${idx}-part-${partIndex}`} className="mr-1 inline-flex flex-wrap gap-1">
                      {part.claims.map((claim) => {
                        const verdict = verifications[claim.id];
                        const colorClass = verdict
                          ? labelClasses[verdict.label]
                          : fallbackClass;
                        const isSelected = selectedClaimId === claim.id;
                        return (
                          <button
                            key={claim.id}
                            type="button"
                            onClick={() => onSelectClaim(claim.id)}
                            className={clsx(
                              'rounded px-1.5 py-0.5 text-sm transition',
                              colorClass,
                              isSelected && 'ring-2 ring-offset-1 ring-accent'
                            )}
                          >
                            {claim.text}
                          </button>
                        );
                      })}
                    </span>
                  );
                })}
          </p>
        </div>
      ))}
    </div>
  );
}
