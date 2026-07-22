import { AssessmentNarrativeSchema, type AssessmentNarrative } from '../domain/schemas.js';
import type { AssessmentResult, RubricDefinition } from '../domain/rubric.js';

const narrativeSchema = {
  type: 'object', additionalProperties: false, required: ['summary','limitations','conditions'],
  properties: {
    summary: { type: 'string' },
    limitations: { type: 'string' },
    conditions: { type: 'array', maxItems: 8, items: { type: 'string' } }
  }
} as const;

export interface NarrativeEvidence {
  claim: string;
  excerpt: string;
  dimensionKey: string;
  signal: string;
  sourceUrl: string;
}

export async function draftAssessmentNarrative(input: {
  productName: string;
  rubric: RubricDefinition;
  result: AssessmentResult;
  evidence: NarrativeEvidence[];
}): Promise<{ narrative: AssessmentNarrative; model: string }> {
  if (input.result.fitScore === null) {
    return {
      model: 'deterministic',
      narrative: {
        summary: 'Evidence is not yet sufficient to publish a TrailGenic Method fit assessment for this product.',
        limitations: 'Additional verified and independent evidence is required.',
        conditions: []
      }
    };
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for assessment narratives');
  const model = process.env.OPENAI_NARRATIVE_MODEL ?? 'gpt-5.6-luna';
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      reasoning: { effort: 'none' },
      instructions: `Write a concise TrailGenic Gear Intelligence assessment from supplied verified evidence and computed results.
Do not add facts, specifications, medical claims, rankings, or source claims. Do not alter or recalculate the score.
State the applicable use case and conditions. Treat fit and evidence confidence separately. Make limitations explicit.`,
      input: JSON.stringify({
        product: input.productName,
        useCase: input.rubric.useCase,
        computedAssessment: input.result,
        verifiedEvidence: input.evidence
      }),
      text: { format: { type: 'json_schema', name: 'trailgenic_assessment_narrative', strict: true, schema: narrativeSchema } },
      max_output_tokens: 1200
    })
  });
  if (!response.ok) throw new Error(`OpenAI narrative failed (${response.status})`);
  const payload = await response.json() as {
    model?: string; output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  const outputText = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === 'output_text')?.text;
  if (!outputText) throw new Error('Narrative generation returned no structured output');
  return { narrative: AssessmentNarrativeSchema.parse(JSON.parse(outputText)), model: payload.model ?? model };
}
