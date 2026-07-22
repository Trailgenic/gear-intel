import { describe, expect, it } from 'vitest';
import { calibrateEvidenceClaim } from '../src/services/evidence-calibration.js';

const baseClaim = {
  dimensionKey: 'traction',
  claim: 'Claim',
  excerpt: 'Excerpt',
  signal: 'positive' as const,
  strength: 5,
  applicability: 1,
  limitations: ''
};

describe('deterministic evidence calibration', () => {
  it('keeps manufacturer specifications neutral', () => {
    const result = calibrateEvidenceClaim('manufacturer', { ...baseClaim, claimBasis: 'specification' });
    expect(result.signal).toBe('neutral');
    expect(result.strength).toBe(5);
  });

  it('caps manufacturer performance language', () => {
    const result = calibrateEvidenceClaim('manufacturer', { ...baseClaim, claimBasis: 'manufacturer_claim' });
    expect(result.strength).toBe(2);
    expect(result.applicability).toBe(0.7);
  });

  it('rejects a source-incompatible claim basis', () => {
    expect(() => calibrateEvidenceClaim('manufacturer', { ...baseClaim, claimBasis: 'controlled_test' })).toThrow('invalid');
  });
});
