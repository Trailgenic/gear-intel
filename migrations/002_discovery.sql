CREATE TABLE IF NOT EXISTS discovery_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','complete','failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  input_tokens integer,
  output_tokens integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS product_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discovery_run_id uuid REFERENCES discovery_runs(id),
  category_key text NOT NULL,
  brand text NOT NULL,
  product_name text NOT NULL,
  model_version text NOT NULL DEFAULT 'current',
  official_url text,
  rationale text NOT NULL,
  evidence_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  trend_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  trend_score numeric(6,2) NOT NULL CHECK (trend_score BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','duplicate')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_key, brand, product_name, model_version)
);

CREATE INDEX IF NOT EXISTS product_candidates_status_score_idx
  ON product_candidates(status, trend_score DESC);
