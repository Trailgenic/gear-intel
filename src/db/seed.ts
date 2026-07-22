import { withTransaction } from './client.js';
import { rubrics, validateRubrics } from '../rubrics/index.js';
import { seedProducts } from '../seed/catalog.js';

export interface SeedResult {
  rubrics: number;
  candidates: number;
}

export async function seedDatabase(): Promise<SeedResult> {
  validateRubrics();
  await withTransaction(async (client) => {
    const categoryIds = new Map<string, string>();
    for (const rubric of Object.values(rubrics)) {
      const category = await client.query({
        text: `INSERT INTO categories (key,label) VALUES ($1,$2)
               ON CONFLICT (key) DO UPDATE SET label=EXCLUDED.label RETURNING id`,
        values: [rubric.categoryKey, rubric.label]
      });
      const categoryId = category.rows[0]?.id as string;
      categoryIds.set(rubric.categoryKey, categoryId);
      await client.query('UPDATE rubric_versions SET active=false WHERE category_id=$1 AND version<>$2', [categoryId, rubric.version]);
      await client.query({
        text: `INSERT INTO rubric_versions (category_id,version,definition,active)
               VALUES ($1,$2,$3,true)
               ON CONFLICT (category_id,version) DO UPDATE SET definition=EXCLUDED.definition,active=true`,
        values: [categoryId, rubric.version, JSON.stringify(rubric)]
      });
    }

    for (const item of seedProducts) {
      const categoryId = categoryIds.get(item.categoryKey);
      if (!categoryId) throw new Error(`Missing category ${item.categoryKey}`);
      const product = await client.query({
        text: `INSERT INTO products (brand,product_family,category_id,status)
               VALUES ($1,$2,$3,'candidate')
               ON CONFLICT (brand,product_family,category_id) DO UPDATE SET updated_at=now()
               RETURNING id`,
        values: [item.brand, item.name, categoryId]
      });
      await client.query({
        text: `INSERT INTO product_versions (product_id,model_version,display_name,specifications)
               VALUES ($1,'q2-2026-seed',$2,'{}'::jsonb)
               ON CONFLICT (product_id,model_version) DO UPDATE SET display_name=EXCLUDED.display_name,updated_at=now()`,
        values: [product.rows[0]?.id, `${item.brand} ${item.name}`]
      });
    }
  });

  return { rubrics: Object.keys(rubrics).length, candidates: seedProducts.length };
}
