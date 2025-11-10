'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { useTranslation } from './LanguageProvider';

export type UploadPayload = {
  file?: File;
  text?: string;
};

type Props = {
  loading: boolean;
  onSubmit: (payload: UploadPayload) => Promise<void>;
};

export default function UploadArea({ loading, onSubmit }: Props) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | undefined>();
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file && text.trim().length === 0) {
      setError(t('upload.validation'));
      return;
    }
    setError(null);
    await onSubmit({ file, text: text.trim() || undefined });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100"
    >
      <div className="flex flex-col gap-4 md:flex-row">
        <label
          className={clsx(
            'flex-1 cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition',
            file ? 'border-accent bg-blue-50/50' : 'border-slate-200 hover:border-accent'
          )}
        >
          <input
            type="file"
            accept=".doc,.docx"
            className="hidden"
            onChange={(event) => {
              const nextFile = event.target.files?.[0];
              setFile(nextFile ?? undefined);
            }}
          />
          <p className="text-sm text-slate-500">{t('upload.hint')}</p>
          {file ? <p className="mt-2 font-medium text-slate-800">{file.name}</p> : null}
        </label>
        <div className="flex-1">
          <textarea
            className="h-32 w-full resize-none rounded-xl border border-slate-200 p-3 text-sm focus:border-accent focus:outline-none"
            placeholder={t('upload.placeholder')}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-accent px-5 py-2 text-white shadow disabled:opacity-60"
        >
        {loading ? t('upload.button.loading') : t('upload.button.start')}
      </button>
      </div>
    </form>
  );
}
