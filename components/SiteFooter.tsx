export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white/60 py-10 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 md:flex-row">
        <p>© {new Date().getFullYear()} ProofKit</p>
      </div>
    </footer>
  );
}
