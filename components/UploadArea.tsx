'use client';

import { useCallback, useState } from 'react';
import clsx from 'clsx';
import { useTranslation } from './LanguageProvider';

export type UploadPayload = {
  file?: File;
  text?: string;
};

type Props = {
  loading: boolean;
  onSubmit: (payload: UploadPayload) => Promise<void>;
  onStop?: () => void;
};

export default function UploadArea({ loading, onSubmit, onStop }: Props) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<'file' | 'text'>('file');
  const { t } = useTranslation();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === 'file' && !file) {
      setError(t('upload.validation'));
      return;
    }
    if (mode === 'text' && text.trim().length === 0) {
      setError(t('upload.validation'));
      return;
    }
    setError(null);
    if (mode === 'file') {
      await onSubmit({ file, text: undefined });
    } else {
      await onSubmit({ text: text.trim() || undefined });
    }
  };

  const handleFiles = useCallback((nextFile?: File) => {
    if (!nextFile) return;
    const allowed = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    if (nextFile && (allowed.includes(nextFile.type) || nextFile.name.endsWith('.docx') || nextFile.name.endsWith('.doc'))) {
      setFile(nextFile);
      setError(null);
    }
  }, []);

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-slate-200/70 bg-white/80 p-6 shadow-md backdrop-blur dark:border-slate-700 dark:bg-slate-900/70"
    >
      <div className="flex items-center gap-3 text-sm text-slate-600">
        <span>{t('upload.mode.note')}</span>
        <div className="flex gap-2">
          {(['file', 'text'] as const).map((value) => (
            <button
              type="button"
              key={value}
              onClick={() => {
                setMode(value);
                setError(null);
                if (value === 'file') {
                  setText('');
                } else {
                  setFile(undefined);
                }
              }}
              className={clsx(
                'rounded-full border px-3 py-1 text-xs transition backdrop-blur',
                mode === value
                  ? 'border-accent text-accent bg-gradient-to-r from-accent/10 via-accent2/10 to-transparent'
                  : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-300'
              )}
            >
              {t(value === 'file' ? 'upload.mode.file' : 'upload.mode.text')}
            </button>
          ))}
        </div>
      </div>

      {mode === 'file' ? (
        <label
          className={clsx(
            'block cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition backdrop-blur',
            file
              ? 'border-accent bg-gradient-to-b from-accent/10 to-white/80 dark:from-accent2/15 dark:to-slate-900/70'
              : isDragging
                ? 'border-accent bg-blue-50/30'
                : 'border-slate-200 hover:border-accent dark:border-slate-700 dark:hover:border-accent'
          )}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            const dropped = event.dataTransfer?.files?.[0];
            handleFiles(dropped);
          }}
        >
          <input
            type="file"
            accept=".doc,.docx"
            className="hidden"
            onChange={(event) => {
              const nextFile = event.target.files?.[0];
              if (!nextFile) return;
              handleFiles(nextFile);
            }}
          />
          <p className="text-sm text-slate-500">{t('upload.hint')}</p>
          {file ? (
            <p className="mt-2 font-medium text-slate-800">{file.name}</p>
          ) : (
            <p className="mt-1 text-xs text-slate-400">{t('upload.dragHint')}</p>
          )}
        </label>
      ) : (
        <textarea
          className="h-40 w-full resize-none rounded-xl border border-slate-200 bg-white/60 p-3 text-sm backdrop-blur focus:border-accent focus:outline-none dark:border-slate-700 dark:bg-slate-900/60"
          placeholder={t('upload.placeholder')}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      )}
      {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
      <div className="mt-4 flex justify-end gap-2">
        {loading && onStop ? (
          <button
            type="button"
            onClick={onStop}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200"
          >
            {t('upload.button.stop')}
          </button>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-gradient-to-r from-accent to-accent2 px-5 py-2 text-white shadow-lg shadow-accent/30 transition hover:shadow-xl disabled:opacity-60"
        >
          {loading ? t('upload.button.loading') : t('upload.button.start')}
        </button>
      </div>
    </form>
  );
}
