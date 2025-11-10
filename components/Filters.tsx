'use client';

import clsx from 'clsx';
import type { Verification } from '@/lib/schemas';
import { useTranslation } from './LanguageProvider';
import type { TranslationKey } from '@/lib/i18n';

type Props = {
  selected: Verification['label'][];
  onToggle: (label: Verification['label']) => void;
  onClear: () => void;
  stats: Record<Verification['label'], number>;
};

const order: Verification['label'][] = ['SUPPORTED', 'REFUTED', 'DISPUTED', 'INSUFFICIENT'];
export default function Filters({ selected, onToggle, onClear, stats }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onClear}
        className={clsx(
          'rounded-full border px-3 py-1 text-xs font-medium',
          selected.length === 0
            ? 'border-accent bg-accent/10 text-accent'
            : 'border-slate-200 text-slate-500 hover:border-accent'
        )}
      >
        {t('filters.all')}
      </button>
      {order.map((label) => (
        <button
          key={label}
          type="button"
          onClick={() => onToggle(label)}
          className={clsx(
            'rounded-full border px-3 py-1 text-xs font-medium transition',
            selected.includes(label)
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-slate-200 text-slate-500 hover:border-accent'
          )}
        >
          {t(`labels.${label}` as TranslationKey)} · {stats[label] ?? 0}
        </button>
      ))}
    </div>
  );
}
