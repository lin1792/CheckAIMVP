'use client';

import { useTranslation } from './LanguageProvider';

const steps = [
  { emoji: '📄', titleKey: 'home.step.upload', descKey: 'home.step.upload.desc' },
  { emoji: '🔍', titleKey: 'home.step.review', descKey: 'home.step.review.desc' },
  { emoji: '📑', titleKey: 'home.step.export', descKey: 'home.step.export.desc' }
];

export default function UsageSteps() {
  const { t } = useTranslation();
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-800">{t('home.stepsTitle')}</h2>
      <p className="mt-1 text-sm text-slate-500">{t('home.stepsSubtitle')}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {steps.map((step) => (
          <div key={step.titleKey} className="rounded-xl border border-slate-100 p-3">
            <div className="text-2xl">{step.emoji}</div>
            <p className="mt-2 text-sm font-semibold text-slate-800">{t(step.titleKey as any)}</p>
            <p className="mt-1 text-xs text-slate-500">{t(step.descKey as any)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
