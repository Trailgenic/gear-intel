import { describe, expect, it } from 'vitest';
import { renderWebflowEmbed } from '../src/publishing/webflow.js';

describe('Webflow export', () => {
  it('renders a complete versioned embed and escapes report data', () => {
    const html = renderWebflowEmbed({
      title: '<script>alert(1)</script>', quarter: '2026-Q2', evidenceCutoff: '2026-06-30', rubricVersion: '2.0.0',
      products: [{ name: '<img src=x>', categoryKey: 'backpacks', fitScore: 80, confidence: 0.8, evidenceCoverage: 0.9, evidenceState: 'verified', fitLabel: 'strong', summary: 'Summary', limitations: '' }]
    });
    expect(html).toContain('Gear Intelligence Hub Embed v2.0.0');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<img src=x>');
    expect(html).toContain('subjective editorial assessment');
  });
});
