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
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-gradient-to-r from-white/90 via-white/80 to-blue-50/70 p-5 shadow-lg shadow-blue-100/60 backdrop-blur dark:border-slate-700 dark:from-slate-900/90 dark:via-slate-900/80 dark:to-slate-800/70">
      <div className="flex flex-wrap gap-3 text-sm text-slate-700 dark:text-slate-200">
        {summaryItems.map((item) => (
          <span
            key={item.key}
            className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-medium shadow-sm backdrop-blur dark:bg-slate-800/80"
          >
            <Dot /> {t(item.key, { count: item.value })}
          </span>
        ))}
      </div>
      <div className="text-right">
        <button
          type="button"
          disabled={!readyToExport || exporting}
          onClick={onExport}
          className="rounded-full bg-gradient-to-r from-accent to-accent2 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-accent/30 transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exporting ? t('summary.exporting') : t('summary.export')}
        </button>
        {inProgress ? (
          <p className="mt-1 text-xs text-slate-500 leading-snug dark:text-slate-300">
            {t('summary.timer', { seconds: elapsedSeconds })}
            <br />
            {t('summary.reminder')}
          </p>
        ) : lastDuration > 0 ? (
          <p className="mt-1 text-xs text-slate-500 leading-snug dark:text-slate-300">
            {t('summary.completedTimer', { seconds: lastDuration })}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Dot() {
  return <span className="h-2 w-2 rounded-full bg-gradient-to-r from-accent to-accent2" />;
}
