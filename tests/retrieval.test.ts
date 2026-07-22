import { afterEach, describe, expect, it } from 'vitest';
import { readResponseTextWithLimit, validateSourceUrl } from '../src/retrieval/retrieve.js';

const originalAllowlist = process.env.SOURCE_HOST_ALLOWLIST;
afterEach(() => { process.env.SOURCE_HOST_ALLOWLIST = originalAllowlist; });

describe('source URL validation', () => {
  it('allows configured public HTTPS sources', () => {
    process.env.SOURCE_HOST_ALLOWLIST = 'example.com';
    expect(validateSourceUrl('https://example.com/review#section').toString()).toBe('https://example.com/review');
  });

  it('rejects unlisted, insecure, and private sources', () => {
    process.env.SOURCE_HOST_ALLOWLIST = 'example.com';
    expect(() => validateSourceUrl('https://other.example/review')).toThrow('not allowlisted');
    expect(() => validateSourceUrl('http://example.com/review')).toThrow('HTTPS');
    expect(() => validateSourceUrl('https://127.0.0.1/review')).toThrow('private-network');
  });

  it('allows a product manufacturer host', () => {
    process.env.SOURCE_HOST_ALLOWLIST = '';
    expect(validateSourceUrl('https://brand.example/products/one', 'https://brand.example/').hostname).toBe('brand.example');
  });

  it('allows a curated independent evidence host without environment configuration', () => {
    process.env.SOURCE_HOST_ALLOWLIST = '';
    expect(validateSourceUrl('https://runrepeat.com/nike-acg-ultrafly-trail').hostname).toBe('runrepeat.com');
  });

  it('streams source bodies within a hard byte limit', async () => {
    await expect(readResponseTextWithLimit(new Response('product evidence'), 100)).resolves.toBe('product evidence');
    await expect(readResponseTextWithLimit(new Response('x'.repeat(101)), 100)).rejects.toThrow('retrieval limit');
  });
});
