import { describe, expect, it } from 'vitest';
import { renderWebflowEmbed } from '../src/publishing/webflow.js';

describe('Webflow export', () => {
  it('renders a complete versioned embed and escapes report data', () => {
    const html = renderWebflowEmbed({
      reportType: 'TrailGenic Gear Intelligence',title: '<script>alert(1)</script>',quarter: '2026-Q2',
      evidenceCutoff: '2026-06-30',generatedAt: '2026-06-30T00:00:00.000Z',rubricVersion: '2.0.0',
      methodology: 'Subjective',version: 'Q2-2026.2',
      products: [{ name: '<img src=x>',categoryKey: 'backpacks',fitScore: 80,fitLabel: 'strong',summary: 'Summary',
        scores: [{ label: 'Metabolic Load',value: 82,note: 'Note' }],sources: [] }]
    });
    expect(html).toContain('Full Webflow HTML Embed v3.0.0');
    expect(html).toContain('Full Rankings');
    expect(html).not.toContain('<img src=x>');
    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).toContain('subjective house assessment');
  });
});
