'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { signIn } from 'next-auth/react';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function AuthModal({ open, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) {
      document.addEventListener('keydown', onKey);
      // lock scroll when modal is open
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', onKey);
        document.body.style.overflow = prev;
      };
    }
  }, [open, onClose]);

  if (!open || !mounted) return null;

  async function handleGoogle() {
    try {
      setAuthLoading(true);
      // Stable full-page redirect to Google OAuth
      await signIn('google');
    } finally {
      // In case redirect is blocked momentarily, keep button disabled and show loading
    }
  }

  function onBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === backdropRef.current) onClose();
  }

  const node = (
    <div
      ref={backdropRef}
      onMouseDown={onBackdrop}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      aria-modal="true"
      role="dialog"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">登录 ProofKit</h2>
          <p className="mt-1 text-sm text-slate-500">选择登录方式，授权后即可开始核查。</p>
        </div>
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={authLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-70"
          >
            {authLoading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> 正在前往 Google…
              </span>
            ) : (
              <>
                <GoogleIcon /> 使用 Google 登录
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={authLoading}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            取消
          </button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          登录即表示你同意我们的基本使用条款。我们仅用于识别用户与追踪免费额度，不会读取你的 Google 数据。
        </p>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 256 262" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M255.9 133.5c0-10.6-.9-18.3-2.9-26.3H130v47.6h72.5c-1.5 11.9-9.6 29.7-27.6 41.7l-.3 2.1 40.1 31 2.8.3c25.7-23.7 40.4-58.6 40.4-96.4"/>
      <path fill="#34A853" d="M130 261.1c36.6 0 67.3-12 89.7-32.7l-42.8-33.1c-11.5 8-27 13.6-46.9 13.6-35.8 0-66-23.7-76.8-56.5l-2 .2-41.9 32.4-.6 1.9c22.3 44.3 68.1 74.2 121.3 74.2"/>
      <path fill="#FBBC05" d="M53.2 152.3c-2.9-8-4.6-16.6-4.6-25.4s1.7-17.4 4.5-25.4l-.1-1.7-42.6-32.9-1.4.7C2.7 86.7 0 109.1 0 126.9s2.7 40.2 8.9 59.3l44.3-34z"/>
      <path fill="#EB4335" d="M130 49.7c25.5 0 42.6 11 52.4 20.2l38.3-37.4C197.2 12.1 166.6 0 130 0 76.8 0 31 29.9 8.7 74.1L53 108c10.8-32.8 41-58.3 77-58.3"/>
    </svg>
  );
}
