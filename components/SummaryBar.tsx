'use client';

import type { Verification } from '@/lib/schemas';
import { useTranslation } from './LanguageProvider';
import type { TranslationKey } from '@/lib/i18n';

type Props = {
  claimsCount: number;
  verifiedCount: number;
  stats: Record<Verification['label'], number>;
  onExport: () => Promise<void>;
  exporting: boolean;
  inProgress: boolean;
  elapsedSeconds: number;
  lastDuration: number;
};

export default function SummaryBar({
  claimsCount,
  verifiedCount,
  stats,
  onExport,
  exporting,
  inProgress,
  elapsedSeconds,
  lastDuration
}: Props) {
  const readyToExport = claimsCount > 0 && verifiedCount > 0;
  const { t } = useTranslation();
  const summaryItems: Array<{ key: TranslationKey; value: number }> = [
    { key: 'summary.claims', value: claimsCount },
    { key: 'summary.verified', value: verifiedCount },
    { key: 'summary.supported', value: stats.SUPPORTED ?? 0 },
    { key: 'summary.refuted', value: stats.REFUTED ?? 0 },
    { key: 'summary.disputed', value: stats.DISPUTED ?? 0 },
    { key: 'summary.insufficient', value: stats.INSUFFICIENT ?? 0 }
  ];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
        {summaryItems.map((item) => (
          <span key={item.key}>{t(item.key, { count: item.value })}</span>
        ))}
      </div>
      <div className="text-right">
        <button
          type="button"
          disabled={!readyToExport || exporting}
          onClick={onExport}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          {exporting ? t('summary.exporting') : t('summary.export')}
        </button>
        {inProgress ? (
          <p className="mt-1 text-xs text-slate-500 leading-snug">
            {t('summary.timer', { seconds: elapsedSeconds })}
            <br />
            {t('summary.reminder')}
          </p>
        ) : lastDuration > 0 ? (
          <p className="mt-1 text-xs text-slate-500 leading-snug">
            {t('summary.completedTimer', { seconds: lastDuration })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
