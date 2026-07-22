import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createProduct, listProducts } from '../src/db/queries.js';
import { CategoryKeySchema, ProductInputSchema } from '../src/domain/schemas.js';
import { handleError, json, requireAdmin, requireMethod } from '../src/http.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, ['GET','POST'])) return;
  try {
    if (req.method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const body = ProductInputSchema.parse(req.body);
      const productVersionId = await createProduct({
        brand: body.brand, productFamily: body.productFamily, modelVersion: body.modelVersion,
        displayName: body.displayName, categoryKey: body.categoryKey, specifications: body.specifications,
        ...(body.manufacturerUrl ? { manufacturerUrl: body.manufacturerUrl } : {})
      });
      return json(res, 201, { productVersionId });
    }
    const rawCategory = typeof req.query.category === 'string' ? req.query.category : undefined;
    const category = rawCategory ? CategoryKeySchema.parse(rawCategory) : undefined;
    json(res, 200, { products: await listProducts(category), evidenceState: 'legacy_unverified' });
  } catch (error) {
    handleError(res, error);
  }
}
