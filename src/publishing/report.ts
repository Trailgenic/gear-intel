import { z } from 'zod';
import { getLatestReport } from '../db/queries.js';

export interface GearScore {
  key?: string | undefined;
  label: string;
  value: number;
  note: string;
}

export interface GearSource {
  url: string;
  title?: string | null | undefined;
  publisher: string;
  sourceType?: string | undefined;
}

export interface GearProductReport {
  productVersionId?: string | undefined;
  name: string;
  modelVersion?: string | undefined;
  categoryKey: string;
  fitScore: number;
  fitLabel: 'strong' | 'conditional' | 'limited';
  summary: string;
  protocolNote?: string | undefined;
  scores: GearScore[];
  sources: GearSource[];
  confidence?: number | undefined;
  evidenceCoverage?: number | undefined;
  evidenceState?: string | undefined;
  sourceCount?: number | undefined;
  evidenceCount?: number | undefined;
  limitations?: string | undefined;
  strengths?: string[] | undefined;
  cautions?: string[] | undefined;
}

export interface GearReport {
  reportType: string;
  title: string;
  quarter: string;
  evidenceCutoff: string;
  generatedAt: string;
  rubricVersion: string;
  methodology: string;
  version: string;
  products: GearProductReport[];
}

const ScoreSchema = z.object({
  key: z.string().optional(),
  label: z.string().min(1),
  value: z.number().min(0).max(100),
  note: z.string().default('')
});

const SourceSchema = z.object({
  url: z.string().url(),
  title: z.string().nullable().optional(),
  publisher: z.string().min(1),
  sourceType: z.string().optional()
});

const ProductSchema = z.object({
  productVersionId: z.string().optional(),
  name: z.string().min(1),
  modelVersion: z.string().optional(),
  categoryKey: z.string().min(1),
  fitScore: z.number().min(0).max(100),
  fitLabel: z.enum(['strong','conditional','limited']).optional(),
  summary: z.string().min(1),
  protocolNote: z.string().optional(),
  scores: z.array(ScoreSchema).default([]),
  sources: z.array(SourceSchema).default([]),
  confidence: z.number().optional(),
  evidenceCoverage: z.number().optional(),
  evidenceState: z.string().optional(),
  sourceCount: z.number().optional(),
  evidenceCount: z.number().optional()
}).passthrough();

const ReportSchema = z.object({
  reportType: z.string().default('TrailGenic Gear Intelligence'),
  title: z.string().min(1),
  quarter: z.string().min(1),
  evidenceCutoff: z.string().min(1),
  generatedAt: z.string().optional(),
  rubricVersion: z.string().default('TrailGenic longevity lens'),
  methodology: z.string().default('TrailGenic subjective scoring of public product and review signals.'),
  version: z.string().optional(),
  products: z.array(ProductSchema)
}).passthrough();

const McpPropertySchema = z.object({
  '@type': z.literal('PropertyValue').optional(),
  name: z.string().min(1),
  value: z.number().min(0).max(100),
  description: z.string().default('')
});

const McpDatasetSchema = z.object({
  '@context': z.string().optional(),
  '@type': z.literal('Dataset'),
  name: z.string().min(1),
  description: z.string().default(''),
  dateCreated: z.string(),
  dateModified: z.string(),
  version: z.string(),
  hasPart: z.array(z.object({
    '@type': z.literal('Product'),
    name: z.string().min(1),
    category: z.string().min(1),
    additionalProperty: z.array(McpPropertySchema),
    description: z.string().min(1)
  }))
}).passthrough();

const categoryLabels: Record<string, string> = {
  backpacks: 'Backpacks',
  'trail-shoes': 'Trail Shoes',
  insulation: 'Insulation',
  'trekking-poles': 'Trekking Poles',
  electrolytes: 'Electrolytes',
  hydration: 'Hydration',
  'shell-rain': 'Shell / Rain',
  headlamps: 'Headlamps'
};

const categoryKeys = new Map(Object.entries(categoryLabels).map(([key,label]) => [label.toLowerCase(),key]));

export function fitLabelForScore(score: number): 'strong' | 'conditional' | 'limited' {
  if (score >= 75) return 'strong';
  if (score >= 55) return 'conditional';
  return 'limited';
}

export function displayQuarter(quarter: string): string {
  const canonical = quarter.match(/^(\d{4})-Q([1-4])$/i);
  if (canonical) return `Q${canonical[2]} ${canonical[1]}`;
  const legacy = quarter.match(/^Q([1-4])[\s-]+(\d{4})$/i);
  if (legacy) return `Q${legacy[1]} ${legacy[2]}`;
  return quarter;
}

function canonicalQuarter(value: string): string {
  const canonical = value.match(/^(\d{4})-Q([1-4])$/i);
  if (canonical) return `${canonical[1]}-Q${canonical[2]}`;
  const legacy = value.match(/Q([1-4])[\s-]+(\d{4})/i);
  return legacy ? `${legacy[2]}-Q${legacy[1]}` : value;
}

function normalizeReport(value: unknown): GearReport {
  const parsed = ReportSchema.parse(value);
  const generatedAt = parsed.generatedAt ?? `${parsed.evidenceCutoff}T00:00:00.000Z`;
  const quarter = canonicalQuarter(parsed.quarter);
  return {
    reportType: parsed.reportType,
    title: parsed.title,
    quarter,
    evidenceCutoff: parsed.evidenceCutoff,
    generatedAt,
    rubricVersion: parsed.rubricVersion,
    methodology: parsed.methodology,
    version: parsed.version ?? `${displayQuarter(quarter).replace(' ','-')}.1`,
    products: parsed.products.map((product) => ({
      ...product,
      fitLabel: product.fitLabel ?? fitLabelForScore(product.fitScore),
      scores: product.scores,
      sources: product.sources
    }))
  };
}

export function reportFromMcpDataset(value: unknown): GearReport {
  const dataset = McpDatasetSchema.parse(value);
  const quarterText = dataset.name.match(/Q[1-4]\s+\d{4}/i)?.[0]
    ?? dataset.version.match(/Q[1-4]-\d{4}/i)?.[0]
    ?? 'Q2 2026';
  const quarter = canonicalQuarter(quarterText);
  return {
    reportType: 'TrailGenic Gear Intelligence',
    title: `Gear Intelligence Report — ${displayQuarter(quarter)}`,
    quarter,
    evidenceCutoff: dataset.dateModified,
    generatedAt: `${dataset.dateModified}T00:00:00.000Z`,
    rubricVersion: 'TrailGenic longevity lens',
    methodology: 'Public review synthesis rescored through TrailGenic’s subjective longevity and fasted high-altitude lens.',
    version: dataset.version,
    products: dataset.hasPart.map((product) => {
      const composite = product.additionalProperty.find((property) => property.name === 'TG Composite Score');
      if (!composite) throw new Error(`MCP product ${product.name} has no TG Composite Score`);
      const fitScore = composite.value;
      return {
        name: product.name,
        categoryKey: categoryKeys.get(product.category.toLowerCase()) ?? product.category.toLowerCase().replace(/[^a-z0-9]+/g,'-'),
        fitScore,
        fitLabel: fitLabelForScore(fitScore),
        summary: product.description,
        scores: product.additionalProperty.filter((property) => property.name !== 'TG Composite Score').map((property) => ({
          label: property.name,
          value: property.value,
          note: property.description
        })),
        sources: []
      };
    })
  };
}

export function reportToMcpDataset(report: GearReport) {
  const shownQuarter = displayQuarter(report.quarter);
  const sourceNames = [...new Set(report.products.flatMap((product) => product.sources.map((source) => source.publisher)))];
  const descriptionSources = sourceNames.length ? ` Source set includes ${sourceNames.join(', ')}.` : '';
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `TrailGenic Gear Intelligence Dataset — ${shownQuarter}`,
    description: `${report.products.length} hiking products scored through the TrailGenic longevity lens for fasted high-altitude performance, metabolic efficiency, and protocol fit.${descriptionSources}`,
    dateCreated: report.generatedAt.slice(0,10),
    dateModified: report.evidenceCutoff,
    version: report.version,
    creator: {
      '@type': 'Organization',
      '@id': 'https://www.trailgenic.com/#organization',
      name: 'TrailGenic'
    },
    url: 'https://mcp.trailgenic.com/datasets/gear/intel',
    isBasedOn: 'https://www.trailgenic.com/gear-intelligence',
    keywords: ['hiking gear','longevity','fasted hiking','altitude performance','metabolic load','TrailGenic'],
    hasPart: [...report.products]
      .sort((a,b) => b.fitScore-a.fitScore || a.name.localeCompare(b.name))
      .map((product) => ({
        '@type': 'Product',
        name: product.name,
        category: categoryLabels[product.categoryKey] ?? product.categoryKey,
        additionalProperty: [{
          '@type': 'PropertyValue',
          name: 'TG Composite Score',
          value: product.fitScore,
          description: 'Composite TrailGenic longevity-lens score (0-100)'
        },...product.scores.map((score) => ({
          '@type': 'PropertyValue',
          name: score.label,
          value: score.value,
          description: score.note
        }))],
        description: product.summary
      }))
  };
}

async function loadLegacyMcpReport(): Promise<GearReport> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch('https://mcp.trailgenic.com/datasets/gear/intel', { signal: controller.signal });
    if (!response.ok) throw new Error(`Legacy MCP dataset unavailable (${response.status})`);
    return reportFromMcpDataset(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

export async function getReportForExport(): Promise<GearReport> {
  const current = await getLatestReport();
  if (current) return normalizeReport(current);
  return loadLegacyMcpReport();
}

export { categoryLabels };
