'use client';

import { useTranslation } from './LanguageProvider';

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();
  const options: { value: 'zh' | 'en'; label: string }[] = [
    { value: 'zh', label: t('language.zh') },
    { value: 'en', label: t('language.en') }
  ];

  return (
    <div className="flex items-center gap-2 text-sm text-slate-500">
      <span>{t('language.switchLabel')}</span>
      <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 shadow-sm">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setLocale(option.value)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              locale === option.value
                ? 'bg-accent text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
