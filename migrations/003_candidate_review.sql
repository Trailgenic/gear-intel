ALTER TABLE product_candidates
  DROP CONSTRAINT IF EXISTS product_candidates_status_check;

ALTER TABLE product_candidates
  ADD CONSTRAINT product_candidates_status_check
  CHECK (status IN ('pending','accepted','held','rejected','duplicate'));

ALTER TABLE product_candidates
  ADD COLUMN IF NOT EXISTS review_note text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS review_corrections jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS product_candidates_review_status_idx
  ON product_candidates(status, reviewed_at DESC);
