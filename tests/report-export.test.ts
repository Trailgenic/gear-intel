import { describe,expect,it } from 'vitest';
import { reportFromMcpDataset,reportToMcpDataset } from '../src/publishing/report.js';

const legacy = {
  '@context': 'https://schema.org','@type': 'Dataset',name: 'TrailGenic Gear Intelligence Dataset — Q2 2026',
  description: 'Legacy',dateCreated: '2026-04-04',dateModified: '2026-06-12',version: 'Q2-2026.2',
  hasPart: [{
    '@type': 'Product',name: 'Example Pack',category: 'Backpacks',description: 'TrailGenic verdict.',
    additionalProperty: [
      { '@type': 'PropertyValue',name: 'TG Composite Score',value: 81,description: 'Composite' },
      { '@type': 'PropertyValue',name: 'Metabolic Load',value: 88,description: 'Low carried mass.' }
    ]
  }]
};

describe('report output contract', () => {
  it('restores the existing MCP dataset into the current report', () => {
    const report = reportFromMcpDataset(legacy);
    expect(report.quarter).toBe('2026-Q2');
    expect(report.products[0]).toMatchObject({ name: 'Example Pack',categoryKey: 'backpacks',fitScore: 81 });
    expect(report.products[0]?.scores[0]).toMatchObject({ label: 'Metabolic Load',value: 88 });
  });

  it('emits the existing Dataset → Product → PropertyValue MCP schema', () => {
    const dataset = reportToMcpDataset(reportFromMcpDataset(legacy));
    expect(dataset['@type']).toBe('Dataset');
    expect(dataset.hasPart[0]?.additionalProperty.map((property) => property.name)).toEqual([
      'TG Composite Score','Metabolic Load'
    ]);
  });
});
