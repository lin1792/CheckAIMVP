'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import UploadArea, { type UploadPayload } from './UploadArea';
import DocPreview from './DocPreview';
import ClaimsList from './ClaimsList';
import EvidenceDrawer from './EvidenceDrawer';
import Filters from './Filters';
import SummaryBar from './SummaryBar';
import LanguageSwitcher from './LanguageSwitcher';
import UsageSteps from './UsageSteps';
import { useTranslation } from './LanguageProvider';
import type {
  Claim,
  EvidenceCandidate,
  ParsedDocument,
  Verification
} from '@/lib/schemas';

const rawConcurrency = Number(process.env.NEXT_PUBLIC_VERIFICATION_CONCURRENCY ?? 2);
const VERIFY_CONCURRENCY =
  Number.isFinite(rawConcurrency) && rawConcurrency > 0 ? Math.min(Math.floor(rawConcurrency), 6) : 2;

const emptyStats = {
  SUPPORTED: 0,
  REFUTED: 0,
  DISPUTED: 0,
  INSUFFICIENT: 0
};

type QuotaState = {
  remaining: number;
  used: number;
  limit: number;
};

export default function HomeClient() {
  const [parsedDoc, setParsedDoc] = useState<ParsedDocument | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [evidenceMap, setEvidenceMap] = useState<Record<string, EvidenceCandidate[]>>({});
  const [verificationMap, setVerificationMap] = useState<Record<string, Verification>>({});
  const [filters, setFilters] = useState<Verification['label'][]>([]);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const abortControllersRef = useRef<AbortController[]>([]);
  const stopRequestedRef = useRef(false);
  const [verificationStart, setVerificationStart] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lastDuration, setLastDuration] = useState(0);
  const { data: session, status } = useSession();
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const { t } = useTranslation();

  const isAbortError = (err: unknown) => err instanceof DOMException && err.name === 'AbortError';

  const refreshQuota = useCallback(async () => {
    if (status !== 'authenticated') return;
    setQuotaLoading(true);
    try {
      const res = await fetch('/api/quota');
      if (!res.ok) throw new Error('quota fetch failed');
      const data: QuotaState = await res.json();
      setQuota(data);
    } catch (err) {
      console.error(err);
    } finally {
      setQuotaLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (status === 'authenticated') {
      refreshQuota();
    } else {
      setQuota(null);
    }
  }, [status, refreshQuota]);

  const fetchWithAbort = useCallback(async (input: RequestInfo, init?: RequestInit) => {
    const controller = new AbortController();
    abortControllersRef.current.push(controller);
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      return response;
    } finally {
      abortControllersRef.current = abortControllersRef.current.filter((item) => item !== controller);
    }
  }, []);

  const abortAllRequests = useCallback(() => {
    abortControllersRef.current.forEach((controller) => controller.abort());
    abortControllersRef.current = [];
  }, []);

  const stats = useMemo(() => {
    const result = { ...emptyStats };
    Object.values(verificationMap).forEach((item) => {
      result[item.label] += 1;
    });
    return result;
  }, [verificationMap]);

  const verifiedCount = useMemo(() => Object.keys(verificationMap).length, [verificationMap]);

  const documentContext = useMemo(() => {
    if (!parsedDoc) return '';
    return parsedDoc.paragraphs.join('\n');
  }, [parsedDoc]);

  const contextPayload = documentContext ? documentContext : undefined;
  const verificationInProgress = verificationStart !== null;

  const processClaim = useCallback(async (claim: Claim) => {
    if (stopRequestedRef.current) return;
    try {
      setEvidenceMap((prev) => ({ ...prev, [claim.id]: prev[claim.id] ?? [] }));
      const searchRes = await fetchWithAbort('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim,
          limit: 10,
          context: contextPayload
        })
      });
      if (searchRes.status === 401) {
        setError(t('auth.loginRequired'));
        return;
      }
      if (searchRes.status === 403) {
        setError(t('auth.noQuota'));
        return;
      }
      if (!searchRes.ok) throw new Error('search failed');
      const evidences: EvidenceCandidate[] = await searchRes.json();
      if (stopRequestedRef.current) return;
      setEvidenceMap((prev) => ({ ...prev, [claim.id]: evidences }));
      if (!evidences.length) return;
      const verifyRes = await fetchWithAbort('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim,
          evidences,
          context: contextPayload
        })
      });
      if (verifyRes.status === 401) {
        setError(t('auth.loginRequired'));
        return;
      }
      if (verifyRes.status === 403) {
        setError(t('auth.noQuota'));
        return;
      }
      if (!verifyRes.ok) throw new Error('verify failed');
      const data: Verification[] = await verifyRes.json();
      if (stopRequestedRef.current) return;
      const verdict = data[0];
      if (verdict) {
        setVerificationMap((prev) => ({ ...prev, [claim.id]: verdict }));
      }
    } catch (err) {
      if (stopRequestedRef.current || isAbortError(err)) {
        return;
      }
      console.error(err);
      setError(t('errors.verifyFailed'));
    }
  }, [contextPayload, t, fetchWithAbort]);

  const fetchClaims = useCallback(
    async (parsed: ParsedDocument) => {
      setClaims([]);
      setEvidenceMap({});
      setVerificationMap({});
      setSelectedClaimId(null);
      setDrawerOpen(false);
      setClaimsLoading(true);
      setVerificationStart(Date.now());
      setElapsedSeconds(0);
      setLastDuration(0);
      // Optimistically reflect quota deduction as soon as verification starts
      setQuota((prev) =>
        prev
          ? {
              ...prev,
              used: Math.min(prev.used + 1, prev.limit),
              remaining: Math.max(prev.remaining - 1, 0)
            }
          : prev
      );
      try {
        const res = await fetchWithAbort('/api/claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sentences: parsed.sentences,
            mapping: parsed.mapping,
            context: parsed.paragraphs.join('\n')
          })
        });
        if (res.status === 401) {
          setError(t('auth.loginRequired'));
          setVerificationStart(null);
          return;
        }
        if (res.status === 403) {
          await refreshQuota();
          setError(t('auth.noQuota'));
          setVerificationStart(null);
          return;
        }
        if (!res.ok) throw new Error('claim request failed');
        const data: Claim[] = await res.json();
        if (stopRequestedRef.current) return;
        setClaims(data);
        await refreshQuota();
        setClaimsLoading(false);

        const queue = [...data];
        let cursor = 0;
        const workerCount = Math.max(1, Math.min(VERIFY_CONCURRENCY, queue.length));

        const runWorker = async () => {
          while (!stopRequestedRef.current) {
            const claim = queue[cursor];
            cursor += 1;
            if (!claim) break;
            await processClaim(claim);
          }
        };

        await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
      } catch (err) {
        if (stopRequestedRef.current || isAbortError(err)) {
          return;
        }
        console.error(err);
        setError(t('errors.claimsFailed'));
        setVerificationStart(null);
        setElapsedSeconds(0);
      } finally {
        setClaimsLoading(false);
        await refreshQuota();
      }
    },
    [processClaim, t, fetchWithAbort, refreshQuota]
  );

  const handleUpload = useCallback(
    async (payload: UploadPayload) => {
      setUploading(true);
      setError(null);
      try {
        if (status !== 'authenticated') {
          setError(t('auth.loginRequired'));
          return;
        }

        stopRequestedRef.current = false;
        const quotaRes = await fetch('/api/quota');
        if (quotaRes.status === 401) {
          setError(t('auth.loginRequired'));
          return;
        }
        if (!quotaRes.ok) {
          throw new Error('quota fetch failed');
        }
        const quotaSnapshot = (await quotaRes.json()) as QuotaState;
        setQuota(quotaSnapshot);
        if (quotaSnapshot.remaining <= 0) {
          setError(t('auth.noQuota'));
          return;
        }

        let response: Response;
        if (payload.file) {
          const formData = new FormData();
          formData.append('file', payload.file);
          if (payload.text) {
            formData.append('text', payload.text);
          }
          response = await fetchWithAbort('/api/extract', {
            method: 'POST',
            body: formData
          });
        } else {
          response = await fetchWithAbort('/api/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: payload.text ?? '' })
          });
        }

        if (response.status === 401) {
          setError(t('auth.loginRequired'));
          return;
        }
        if (!response.ok) {
          throw new Error(t('errors.parseFailed'));
        }
        const parsed: ParsedDocument = await response.json();
        if (stopRequestedRef.current) return;
        setParsedDoc(parsed);
        await fetchClaims(parsed);
        await refreshQuota();
      } catch (err) {
        if (stopRequestedRef.current || isAbortError(err)) {
          return;
        }
        console.error(err);
        setError(t('errors.uploadFailed'));
        setVerificationStart(null);
        setElapsedSeconds(0);
      } finally {
        setUploading(false);
      }
    },
    [fetchClaims, t, fetchWithAbort, status, refreshQuota]
  );

  useEffect(() => {
    if (!verificationStart) {
      setElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - verificationStart) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [verificationStart]);

  useEffect(() => {
    if (
      !verificationStart ||
      claims.length === 0 ||
      Object.keys(verificationMap).length < claims.length
    ) {
      return;
    }
    setVerificationStart(null);
    setLastDuration(elapsedSeconds);
  }, [verificationStart, claims.length, verificationMap, elapsedSeconds]);

  const handleStop = useCallback(() => {
    stopRequestedRef.current = true;
    abortAllRequests();
    setClaimsLoading(false);
    setUploading(false);
    setError(t('errors.stopped'));
    setVerificationStart(null);
    setElapsedSeconds(0);
    setLastDuration(0);
  }, [abortAllRequests, t]);

  const toggleFilter = (label: Verification['label']) => {
    setFilters((prev) => (prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]));
  };

  const clearFilters = () => setFilters([]);

  const handleSelectClaim = (claimId: string) => {
    setSelectedClaimId(claimId);
    setDrawerOpen(true);
  };

  const selectedClaim = claims.find((claim) => claim.id === selectedClaimId) ?? null;
  const selectedEvidences = selectedClaim ? evidenceMap[selectedClaim.id] ?? [] : [];
  const selectedVerification = selectedClaim ? verificationMap[selectedClaim.id] : undefined;

  const handleExport = useCallback(async () => {
    if (!claims.length || !Object.keys(verificationMap).length) return;
    setExporting(true);
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claims,
          verifications: Object.values(verificationMap),
          evidenceMap,
          generatedAt: new Date().toISOString()
        })
      });
      if (!res.ok) throw new Error('report failed');
      const data = await res.json();
      const blob = new Blob([data.html], {
        type: 'application/msword'
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `checkai-report-${Date.now()}.doc`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError(t('errors.exportFailed'));
    } finally {
      setExporting(false);
    }
  }, [claims, verificationMap, evidenceMap, t]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-10">
      <header className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white/90 via-white/70 to-blue-50/70 p-8 shadow-[0_20px_70px_-35px_rgba(46,115,255,0.6)] dark:border-slate-800 dark:from-slate-900/90 dark:via-slate-900/70 dark:to-slate-800/60">
        <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(circle_at_20%_20%,rgba(124,58,237,0.12),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.18),transparent_38%),radial-gradient(circle_at_50%_80%,rgba(16,185,129,0.12),transparent_40%)]" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3 md:max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent shadow-sm backdrop-blur dark:border-accent/40 dark:bg-slate-900/60">
              AI Evidence Workspace · 新一代
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 lg:text-4xl">
              {t('home.title')}
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-300">
              {t('home.subtitle')}
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#upload" className="btn-primary">开始核查</a>
              <a href="#features" className="btn-outline">查看流程</a>
            </div>
          </div>
          <div className="grid w-full max-w-sm grid-cols-2 gap-3 md:max-w-xs">
            <div className="rounded-2xl border border-white/60 bg-white/70 p-3 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-800/70">
              <p className="text-xs text-slate-500 dark:text-slate-400">实时核查</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">AI+Web</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">搜索 + 模型双核</p>
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/70 p-3 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-800/70">
              <p className="text-xs text-slate-500 dark:text-slate-400">免费额度</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
                {quota && session?.user?.email ? `${quota.remaining} / ${quota.limit}` : '登录后可见'}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">额度用完自动提示</p>
            </div>
          </div>
        </div>
      </header>

      <UsageSteps />

      <div id="upload">
        <UploadArea loading={uploading} onSubmit={handleUpload} onStop={handleStop} />
      </div>


      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}

      <SummaryBar
        claimsCount={claims.length}
        verifiedCount={verifiedCount}
        stats={stats}
        onExport={handleExport}
        exporting={exporting}
        inProgress={verificationInProgress}
        elapsedSeconds={elapsedSeconds}
        lastDuration={lastDuration}
      />

      <div className="card p-4">
        <Filters selected={filters} onToggle={toggleFilter} onClear={clearFilters} />
      </div>

      <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
        <div className="card p-4">
          <DocPreview
            document={parsedDoc}
            claims={claims}
            verifications={verificationMap}
            selectedClaimId={selectedClaimId}
            onSelectClaim={handleSelectClaim}
          />
        </div>
        <div className="space-y-4">
          <div className="card p-4">
            <ClaimsList
              claims={claims}
              verifications={verificationMap}
              evidences={evidenceMap}
              filters={filters}
              loading={claimsLoading}
              onSelectClaim={handleSelectClaim}
              selectedClaimId={selectedClaimId}
            />
          </div>
        </div>
      </div>

      <EvidenceDrawer
        open={drawerOpen}
        claim={selectedClaim}
        evidences={selectedEvidences}
        verification={selectedVerification}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
