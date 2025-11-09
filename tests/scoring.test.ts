import { describe, expect, it } from 'vitest';
import { scoreVerification } from '@/lib/scoring';
import type { EvidenceCandidate } from '@/lib/schemas';

const mockEvidence = (overrides: Partial<EvidenceCandidate> = {}): EvidenceCandidate => ({
  id: overrides.id ?? crypto.randomUUID(),
  source: overrides.source ?? 'web',
  url: overrides.url ?? 'https://example.com',
  title: overrides.title ?? 'Example',
  quote: overrides.quote ?? 'Example quote',
  authority: overrides.authority ?? 0.8,
  published_at: overrides.published_at
});

describe('scoring fusion', () => {
  it('labels supported when entail dominates', () => {
    const result = scoreVerification('claim-1', [
      { evidence: mockEvidence(), score: { entail: 0.9, contradict: 0.05, neutral: 0.05 } },
      { evidence: mockEvidence(), score: { entail: 0.6, contradict: 0.2, neutral: 0.2 } }
    ]);
    expect(result.label).toBe('SUPPORTED');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.citations.length).toBeGreaterThan(0);
  });

  it('labels refuted when contradiction dominates', () => {
    const result = scoreVerification('claim-2', [
      { evidence: mockEvidence({ url: 'https://b.com' }), score: { entail: 0.1, contradict: 0.8, neutral: 0.1 } }
    ]);
    expect(result.label).toBe('REFUTED');
  });
});
