'use client';

import { useCallback, useMemo, useState } from 'react';
import UploadArea, { type UploadPayload } from './UploadArea';
import DocPreview from './DocPreview';
import ClaimsList from './ClaimsList';
import EvidenceDrawer from './EvidenceDrawer';
import Filters from './Filters';
import SummaryBar from './SummaryBar';
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

  const stats = useMemo(() => {
    const result = { ...emptyStats };
    Object.values(verificationMap).forEach((item) => {
      result[item.label] += 1;
    });
    return result;
  }, [verificationMap]);

  const verifiedCount = useMemo(() => Object.keys(verificationMap).length, [verificationMap]);

  const processClaim = useCallback(async (claim: Claim) => {
    try {
      setEvidenceMap((prev) => ({ ...prev, [claim.id]: prev[claim.id] ?? [] }));
      const searchRes = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim })
      });
      if (!searchRes.ok) throw new Error('search failed');
      const evidences: EvidenceCandidate[] = await searchRes.json();
      setEvidenceMap((prev) => ({ ...prev, [claim.id]: evidences }));
      if (!evidences.length) return;
      const verifyRes = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim, evidences })
      });
      if (!verifyRes.ok) throw new Error('verify failed');
      const data: Verification[] = await verifyRes.json();
      const verdict = data[0];
      if (verdict) {
        setVerificationMap((prev) => ({ ...prev, [claim.id]: verdict }));
      }
    } catch (err) {
      console.error(err);
      setError('部分陈述验证失败，请稍后重试');
    }
  }, []);

  const fetchClaims = useCallback(
    async (parsed: ParsedDocument) => {
      setClaims([]);
      setEvidenceMap({});
      setVerificationMap({});
      setSelectedClaimId(null);
      setDrawerOpen(false);
      setClaimsLoading(true);
      try {
        const res = await fetch('/api/claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sentences: parsed.sentences,
            mapping: parsed.mapping,
            context: parsed.paragraphs.slice(0, 3).join('\n')
          })
        });
        if (!res.ok) throw new Error('claim request failed');
        const data: Claim[] = await res.json();
        setClaims(data);
        setClaimsLoading(false);
        for (const claim of data) {
          // eslint-disable-next-line no-await-in-loop
          await processClaim(claim);
        }
      } catch (err) {
        console.error(err);
        setError('陈述识别失败');
      } finally {
        setClaimsLoading(false);
      }
    },
    [processClaim]
  );

  const handleUpload = useCallback(
    async (payload: UploadPayload) => {
      setUploading(true);
      setError(null);
      try {
        let response: Response;
        if (payload.file) {
          const formData = new FormData();
          formData.append('file', payload.file);
          if (payload.text) {
            formData.append('text', payload.text);
          }
          response = await fetch('/api/extract', {
            method: 'POST',
            body: formData
          });
        } else {
          response = await fetch('/api/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: payload.text ?? '' })
          });
        }

        if (!response.ok) {
          throw new Error('无法解析文档');
        }
        const parsed: ParsedDocument = await response.json();
        setParsedDoc(parsed);
        await fetchClaims(parsed);
      } catch (err) {
        console.error(err);
        setError('上传或解析失败');
      } finally {
        setUploading(false);
      }
    },
    [fetchClaims]
  );

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
      const blob = new Blob([data.markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `checkai-report-${Date.now()}.md`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError('导出失败');
    } finally {
      setExporting(false);
    }
  }, [claims, verificationMap]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">CheckAI MVP</p>
        <h1 className="text-3xl font-bold text-slate-900">事实核查工作台</h1>
        <p className="text-sm text-slate-500">
          支持 .docx 上传、可核查陈述识别、外部检索与 NLI 判定，生成完整 Markdown 报告。
        </p>
      </header>

      <UploadArea loading={uploading} onSubmit={handleUpload} />

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}

      <SummaryBar
        claimsCount={claims.length}
        verifiedCount={verifiedCount}
        stats={stats}
        onExport={handleExport}
        exporting={exporting}
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
