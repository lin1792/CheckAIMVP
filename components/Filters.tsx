'use client';

import clsx from 'clsx';
import type { Verification } from '@/lib/schemas';
import { useTranslation } from './LanguageProvider';
import type { TranslationKey } from '@/lib/i18n';

type Props = {
  selected: Verification['label'][];
  onToggle: (label: Verification['label']) => void;
  onClear: () => void;
};

const order: Verification['label'][] = ['SUPPORTED', 'REFUTED', 'DISPUTED', 'INSUFFICIENT'];
export default function Filters({ selected, onToggle, onClear }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onClear}
        className={clsx(
          'rounded-full border px-3 py-1 text-xs font-medium backdrop-blur',
          selected.length === 0
            ? 'border-accent bg-gradient-to-r from-accent/15 to-accent2/10 text-accent'
            : 'border-slate-200 text-slate-500 hover:border-accent dark:border-slate-700 dark:text-slate-300'
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
            'rounded-full border px-3 py-1 text-xs font-medium transition backdrop-blur',
            selected.includes(label)
              ? 'border-accent bg-gradient-to-r from-accent/15 to-accent2/10 text-accent'
              : 'border-slate-200 text-slate-500 hover:border-accent dark:border-slate-700 dark:text-slate-300'
          )}
        >
          {t(`labels.${label}` as TranslationKey)}
        </button>
      ))}
    </div>
  );
}
