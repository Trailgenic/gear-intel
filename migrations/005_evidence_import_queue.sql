CREATE TABLE IF NOT EXISTS evidence_import_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_version_id uuid NOT NULL REFERENCES product_versions(id) ON DELETE CASCADE,
  url text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('manufacturer','expert_review','community','scientific','operator_note')),
  published_at date,
  evidence_cutoff date,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','complete','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  last_error text NOT NULL DEFAULT '',
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_version_id, url)
);

CREATE INDEX IF NOT EXISTS evidence_import_queue_status_idx
  ON evidence_import_queue(status, attempts, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS evidence_items_source_claim_unique
  ON evidence_items(product_version_id, source_snapshot_id, dimension_key, md5(claim));

WITH accepted_sources AS (
  SELECT version.id AS product_version_id,
         source.url,
         CASE
           WHEN regexp_replace(split_part(source.url,'/',3), '^(www|about)\.', '') =
                regexp_replace(split_part(corrections.official_url,'/',3), '^(www|about)\.', '')
           THEN 'manufacturer'
           ELSE 'expert_review'
         END AS source_type
  FROM product_candidates AS candidate
  CROSS JOIN LATERAL (
    SELECT candidate.review_corrections->>'categoryKey' AS category_key,
           candidate.review_corrections->>'brand' AS brand,
           candidate.review_corrections->>'productName' AS product_name,
           candidate.review_corrections->>'modelVersion' AS model_version,
           candidate.review_corrections->>'officialUrl' AS official_url,
           candidate.review_corrections->'evidenceUrls' AS evidence_urls
  ) AS corrections
  JOIN categories AS category ON category.key = corrections.category_key
  JOIN products AS product
    ON product.category_id = category.id
   AND product.brand = corrections.brand
   AND product.product_family = corrections.product_name
  JOIN product_versions AS version
    ON version.product_id = product.id
   AND version.model_version = corrections.model_version
  CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(corrections.evidence_urls, '[]'::jsonb)) AS source(url)
  WHERE candidate.status = 'accepted'
    AND jsonb_typeof(corrections.evidence_urls) = 'array'
)
INSERT INTO evidence_import_queue (product_version_id, url, source_type)
SELECT product_version_id, url, source_type
FROM accepted_sources
ON CONFLICT (product_version_id, url) DO NOTHING;
