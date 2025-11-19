'use client';

import { useTranslation } from './LanguageProvider';

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();
  const toggleLocale = () => setLocale(locale === 'zh' ? 'en' : 'zh');
  const displayLabel = locale === 'zh' ? '中' : 'EN';

  return (
    <button
      type="button"
      onClick={toggleLocale}
      aria-label={t('language.switchLabel')}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[10px] font-semibold uppercase text-slate-700 shadow-sm transition hover:border-slate-300 hover:shadow focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-500"
    >
      {displayLabel}
    </button>
  );
}
