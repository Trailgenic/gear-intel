ALTER TABLE editorial_scores
  ADD COLUMN IF NOT EXISTS dimension_scores jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS protocol_note text NOT NULL DEFAULT '';

ALTER TABLE editorial_scores
  DROP CONSTRAINT IF EXISTS editorial_scores_dimension_scores_array;

ALTER TABLE editorial_scores
  ADD CONSTRAINT editorial_scores_dimension_scores_array
  CHECK (jsonb_typeof(dimension_scores) = 'array');
