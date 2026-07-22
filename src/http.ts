import type { VercelRequest, VercelResponse } from '@vercel/node';
import { timingSafeEqual } from 'node:crypto';
import { ZodError } from 'zod';

export function json(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).json(body);
}

export function requireMethod(req: VercelRequest, res: VercelResponse, allowed: string[]): boolean {
  if (req.method && allowed.includes(req.method)) return true;
  res.setHeader('Allow', allowed.join(', '));
  json(res, 405, { error: 'Method not allowed' });
  return false;
}

export function requireAdmin(req: VercelRequest, res: VercelResponse): boolean {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) {
    json(res, 503, { error: 'Admin API is not configured' });
    return false;
  }
  const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const suppliedBuffer = Buffer.from(supplied ?? '');
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    json(res, 401, { error: 'Unauthorized' });
    return false;
  }
  return true;
}

export function handleError(res: VercelResponse, error: unknown): void {
  if (error instanceof ZodError) {
    json(res, 400, { error: 'Invalid request', details: error.flatten() });
    return;
  }
  const message = error instanceof Error ? error.message : 'Unknown error';
  if (message.includes('OPENAI_API_KEY') || message.includes('DATABASE_URL') || message.includes('POSTGRES_URL')) {
    json(res, 503, { error: 'Service is not configured' });
    return;
  }
  const expectedPrefixes = [
    'Product version not found', 'Source ', 'Only HTTPS', 'IP and private-network',
    'Pending candidate not found', 'Candidate category', 'Every report assessment',
    'Report assessments', 'Assessment not found', 'Unknown rubric dimension',
    'Unsupported EVIDENCE_MODEL_PROVIDER', 'Discovery produced no source-grounded candidates'
  ];
  if (expectedPrefixes.some((prefix) => message.startsWith(prefix))) {
    json(res, 422, { error: message });
    return;
  }
  console.error(error);
  json(res, 500, { error: 'Internal server error' });
}
