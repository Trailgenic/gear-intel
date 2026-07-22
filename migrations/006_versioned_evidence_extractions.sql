CREATE TABLE IF NOT EXISTS evidence_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_version_id uuid NOT NULL REFERENCES product_versions(id) ON DELETE CASCADE,
  source_snapshot_id uuid NOT NULL REFERENCES source_snapshots(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  product_match text NOT NULL CHECK (product_match IN ('exact','family','uncertain','mismatch')),
  source_summary text NOT NULL DEFAULT '',
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_version_id, source_snapshot_id, provider, model, prompt_version)
);

ALTER TABLE evidence_items
  ADD COLUMN IF NOT EXISTS extraction_id uuid REFERENCES evidence_extractions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS claim_basis text NOT NULL DEFAULT 'legacy_unclassified';

ALTER TABLE evidence_items
  DROP CONSTRAINT IF EXISTS evidence_items_claim_basis_check;

ALTER TABLE evidence_items
  ADD CONSTRAINT evidence_items_claim_basis_check
  CHECK (claim_basis IN (
    'specification','manufacturer_claim','independent_observation',
    'controlled_test','community_report','operator_observation','legacy_unclassified'
  ));

INSERT INTO evidence_extractions
  (product_version_id,source_snapshot_id,provider,model,prompt_version,product_match,warnings,input_tokens,output_tokens)
SELECT DISTINCT evidence.product_version_id,
       snapshot.id,
       'openai',
       COALESCE(snapshot.extraction_model,'legacy-unknown'),
       COALESCE(snapshot.prompt_version,'legacy-unknown'),
       COALESCE(snapshot.metadata->>'productMatch','uncertain'),
       COALESCE(snapshot.metadata->'conflictsOrWarnings','[]'::jsonb),
       snapshot.input_tokens,
       snapshot.output_tokens
FROM evidence_items AS evidence
JOIN source_snapshots AS snapshot ON snapshot.id=evidence.source_snapshot_id
ON CONFLICT (product_version_id,source_snapshot_id,provider,model,prompt_version) DO NOTHING;

UPDATE evidence_items AS evidence
SET extraction_id=extraction.id
FROM evidence_extractions AS extraction
JOIN source_snapshots AS snapshot ON snapshot.id=extraction.source_snapshot_id
WHERE evidence.product_version_id=extraction.product_version_id
  AND evidence.source_snapshot_id=extraction.source_snapshot_id
  AND extraction.model=COALESCE(snapshot.extraction_model,'legacy-unknown')
  AND extraction.prompt_version=COALESCE(snapshot.prompt_version,'legacy-unknown')
  AND evidence.extraction_id IS NULL;

ALTER TABLE evidence_items
  ALTER COLUMN extraction_id SET NOT NULL;

DROP INDEX IF EXISTS evidence_items_source_claim_unique;

CREATE UNIQUE INDEX IF NOT EXISTS evidence_items_extraction_claim_unique
  ON evidence_items(extraction_id,dimension_key,md5(claim));

CREATE INDEX IF NOT EXISTS evidence_extractions_product_idx
  ON evidence_extractions(product_version_id,created_at DESC);

UPDATE evidence_items AS evidence
SET verification_state='rejected',
    verified_by='system: extraction-v3 superseded',
    verified_at=now()
FROM evidence_extractions AS extraction
WHERE evidence.extraction_id=extraction.id
  AND extraction.prompt_version='evidence-extraction-v3-segment-citations'
  AND evidence.verification_state='unverified';

UPDATE evidence_import_queue AS queue
SET status='queued',attempts=0,last_error='',result='{}'::jsonb,
    started_at=NULL,completed_at=NULL,updated_at=now()
WHERE EXISTS (
  SELECT 1
  FROM evidence_extractions AS extraction
  JOIN source_snapshots AS snapshot ON snapshot.id=extraction.source_snapshot_id
  JOIN sources AS source ON source.id=snapshot.source_id
  WHERE extraction.product_version_id=queue.product_version_id
    AND source.url=queue.url
    AND extraction.prompt_version='evidence-extraction-v3-segment-citations'
);
