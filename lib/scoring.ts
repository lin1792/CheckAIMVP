import type { EvidenceCandidate, Verification } from './schemas';

export type NLIScore = {
  entail: number;
  contradict: number;
  neutral: number;
};

const SUPPORT_THRESHOLD = Number(process.env.SUPPORT_THRESHOLD ?? 0.5);
const REFUTE_THRESHOLD = Number(process.env.REFUTE_THRESHOLD ?? 0.5);
const COVERAGE_DIVISOR = Number(process.env.COVERAGE_DIVISOR ?? 6);
const CONFIDENCE_BASE_WEIGHT = Number(process.env.CONFIDENCE_BASE_WEIGHT ?? 0.7);

function aggregate(evidences: Array<{ evidence: EvidenceCandidate; score: NLIScore }>) {
  return evidences.reduce(
    (acc, { evidence, score }) => {
      const weight = evidence.authority;
      acc.support += weight * score.entail;
      acc.refute += weight * score.contradict;
      acc.neutral += weight * score.neutral;
      if (score.entail > 0.5) acc.citations.push(evidence.url);
      if (score.contradict > 0.5) acc.citations.push(evidence.url);
      acc.descriptions.push(`${evidence.title}: ${score.entail.toFixed(2)} entail / ${score.contradict.toFixed(2)} contradict`);
      return acc;
    },
    { support: 0, refute: 0, neutral: 0, citations: [] as string[], descriptions: [] as string[] }
  );
}

function pickLabel(support: number, refute: number): Verification['label'] {
  if (support >= SUPPORT_THRESHOLD && support >= refute * 1.2) {
    return 'SUPPORTED';
  }
  if (refute >= REFUTE_THRESHOLD && refute >= support * 1.2) {
    return 'REFUTED';
  }
  if (support > 0.35 && refute > 0.35) {
    return 'DISPUTED';
  }
  return 'INSUFFICIENT';
}

function confidenceScore(support: number, refute: number, neutral: number, evidenceCount: number): number {
  const dominant = Math.max(support, refute);
  const total = support + refute + neutral + 1e-6;
  const base = (dominant / total) * CONFIDENCE_BASE_WEIGHT;
  const coverageBoost = Math.min(evidenceCount / COVERAGE_DIVISOR, 1) * (1 - CONFIDENCE_BASE_WEIGHT);
  return Math.min(1, Number((base + coverageBoost).toFixed(4)));
}

export function scoreVerification(
  claimId: string,
  evidences: Array<{ evidence: EvidenceCandidate; score: NLIScore }>
): Verification {
  const { support, refute, neutral, citations, descriptions } = aggregate(evidences);
  const label = pickLabel(support, refute);
  const confidence = confidenceScore(support, refute, neutral, evidences.length);
  const reason = descriptions.join('\n');
  return {
    claimId,
    label,
    confidence,
    reason: reason || 'Insufficient evidence to decide.',
    citations: Array.from(new Set(citations)).slice(0, 10)
  };
}
