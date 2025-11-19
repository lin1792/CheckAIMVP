'use client';

import { useState } from 'react';
import { useSession, signOut, signIn } from 'next-auth/react';
import AuthModal from './AuthModal';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeToggle from './ThemeToggle';

export default function SiteHeader() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-slate-200 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-slate-800 dark:bg-slate-950/80 dark:supports-[backdrop-filter]:bg-slate-950/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <a href="#" className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white ring-1 ring-accent/30 shadow-sm dark:bg-white dark:ring-accent/30">
            <LogoMark />
          </span>
          <span className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">
            ProofKit
          </span>
        </a>
        <nav className="hidden items-center gap-6 md:flex" />
        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <LanguageSwitcher />
          {session?.user ? (
            <>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {session.user.name ?? session.user.email}
              </span>
              <button
                type="button"
                onClick={() => signOut()}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                退出登录
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              disabled={status === 'loading'}
              className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-accent/50 dark:text-white"
            >
              登录
            </button>
          )}
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 shadow-sm transition md:hidden dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100"
          onClick={() => setMenuOpen((v) => !v)}
        >
          菜单
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5"/></svg>
        </button>
      </div>
      {menuOpen ? (
        <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden dark:border-slate-800 dark:bg-slate-950">
          <nav className="grid gap-3" />
          <div className="mt-3 flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
            {session?.user ? (
              <button
                type="button"
                onClick={() => signOut()}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                退出登录
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                disabled={status === 'loading'}
                className="w-full rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                登录
              </button>
            )}
          </div>
        </div>
      ) : null}

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </header>
  );
}

function LogoMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="2" className="fill-[#2F80ED]" />
      <rect x="14" y="3" width="7" height="7" rx="2" className="fill-[#7C3AED]" />
      <rect x="3" y="14" width="7" height="7" rx="2" className="fill-[#5A8DF4]" />
      <rect x="14" y="14" width="7" height="7" rx="2" className="fill-[#A76CF8]" />
    </svg>
  );
}
