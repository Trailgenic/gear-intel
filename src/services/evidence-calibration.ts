import type { EvidenceExtraction, SourceType } from '../domain/schemas.js';

type EvidenceClaim = EvidenceExtraction['claims'][number];

const allowedBases: Record<SourceType, Set<EvidenceClaim['claimBasis']>> = {
  manufacturer: new Set(['specification','manufacturer_claim']),
  expert_review: new Set(['specification','independent_observation','controlled_test']),
  scientific: new Set(['specification','controlled_test']),
  community: new Set(['community_report']),
  operator_note: new Set(['specification','operator_observation'])
};

export function calibrateEvidenceClaim(sourceType: SourceType, claim: EvidenceClaim): EvidenceClaim {
  if (!allowedBases[sourceType].has(claim.claimBasis)) {
    throw new Error(`Claim basis ${claim.claimBasis} is invalid for source type ${sourceType}`);
  }
  if (claim.claimBasis === 'specification') {
    return { ...claim, signal: 'neutral' };
  }
  if (claim.claimBasis === 'manufacturer_claim') {
    return { ...claim, strength: Math.min(claim.strength, 2), applicability: Math.min(claim.applicability, 0.7) };
  }
  if (claim.claimBasis === 'independent_observation') {
    return { ...claim, strength: Math.min(claim.strength, 4) };
  }
  if (claim.claimBasis === 'community_report') {
    return { ...claim, strength: Math.min(claim.strength, 2), applicability: Math.min(claim.applicability, 0.6) };
  }
  if (claim.claimBasis === 'operator_observation') {
    return { ...claim, strength: Math.min(claim.strength, 3), applicability: Math.min(claim.applicability, 0.8) };
  }
  return claim;
}

export function calibrateEvidenceExtraction(sourceType: SourceType, extraction: EvidenceExtraction): EvidenceExtraction {
  return { ...extraction, claims: extraction.claims.map((claim) => calibrateEvidenceClaim(sourceType, claim)) };
}
