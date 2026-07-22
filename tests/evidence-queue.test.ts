import { describe, expect, it } from 'vitest';
import { sourceTypeForUrl } from '../src/services/evidence-queue.js';

describe('evidence queue source classification', () => {
  it('recognizes official and manufacturer subdomains', () => {
    expect(sourceTypeForUrl('https://www.nike.com/product', 'https://www.nike.com/product')).toBe('manufacturer');
    expect(sourceTypeForUrl('https://about.nike.com/news', 'https://www.nike.com/product')).toBe('manufacturer');
  });

  it('keeps independent reviews separate from manufacturer evidence', () => {
    expect(sourceTypeForUrl('https://runrepeat.com/product', 'https://www.nike.com/product')).toBe('expert_review');
  });
});
