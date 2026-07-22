import { describe, expect, it } from 'vitest';
import { fitLabelForScore, quarterForDate } from '../src/services/editorial.js';

describe('editorial reporting', () => {
  it('derives the reporting quarter from the UTC evidence date', () => {
    expect(quarterForDate(new Date('2026-06-30T23:59:59Z'))).toBe('2026-Q2');
    expect(quarterForDate(new Date('2026-07-01T00:00:00Z'))).toBe('2026-Q3');
  });

  it('derives display bands from the subjective TG Score', () => {
    expect(fitLabelForScore(100)).toBe('strong');
    expect(fitLabelForScore(75)).toBe('strong');
    expect(fitLabelForScore(74)).toBe('conditional');
    expect(fitLabelForScore(55)).toBe('conditional');
    expect(fitLabelForScore(54)).toBe('limited');
    expect(fitLabelForScore(0)).toBe('limited');
  });
});
