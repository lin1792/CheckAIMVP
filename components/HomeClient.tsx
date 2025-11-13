'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const emptyStats = {
  SUPPORTED: 0,
  REFUTED: 0,
  DISPUTED: 0,
  INSUFFICIENT: 0
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
  const { t } = useTranslation();

  const isAbortError = (err: unknown) => err instanceof DOMException && err.name === 'AbortError';

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
        if (!res.ok) throw new Error('claim request failed');
        const data: Claim[] = await res.json();
        if (stopRequestedRef.current) return;
        setClaims(data);
        setClaimsLoading(false);
        for (const claim of data) {
          if (stopRequestedRef.current) break;
          // eslint-disable-next-line no-await-in-loop
          await processClaim(claim);
        }
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
      }
    },
    [processClaim, t, fetchWithAbort]
  );

  const handleUpload = useCallback(
    async (payload: UploadPayload) => {
      setUploading(true);
      setError(null);
      try {
        stopRequestedRef.current = false;
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

        if (!response.ok) {
          throw new Error(t('errors.parseFailed'));
        }
        const parsed: ParsedDocument = await response.json();
        if (stopRequestedRef.current) return;
        setParsedDoc(parsed);
        await fetchClaims(parsed);
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
    [fetchClaims, t, fetchWithAbort]
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
  }, [claims, verificationMap, t]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">{t('app.badge')}</p>
          <LanguageSwitcher />
        </div>
        <h1 className="text-3xl font-bold text-slate-900">{t('home.title')}</h1>
        <p className="text-sm text-slate-500">{t('home.subtitle')}</p>
      </header>

      <UsageSteps />

      <UploadArea loading={uploading} onSubmit={handleUpload} onStop={handleStop} />

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

      <Filters selected={filters} onToggle={toggleFilter} onClear={clearFilters} stats={stats} />

      <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
        <DocPreview
          document={parsedDoc}
          claims={claims}
          verifications={verificationMap}
          selectedClaimId={selectedClaimId}
          onSelectClaim={handleSelectClaim}
        />
        <div className="space-y-4">
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
