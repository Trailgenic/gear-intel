CREATE TABLE IF NOT EXISTS pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type text NOT NULL CHECK (trigger_type IN ('scheduled','manual')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','partial','complete','failed')),
  stage text NOT NULL DEFAULT 'initializing',
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  exceptions jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS editorial_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id uuid REFERENCES pipeline_runs(id) ON DELETE SET NULL,
  quarter text NOT NULL,
  evidence_cutoff date NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','complete','failed')),
  input_tokens integer,
  output_tokens integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS editorial_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  editorial_run_id uuid NOT NULL REFERENCES editorial_runs(id) ON DELETE CASCADE,
  product_version_id uuid NOT NULL REFERENCES product_versions(id) ON DELETE CASCADE,
  tg_score smallint NOT NULL CHECK (tg_score BETWEEN 0 AND 100),
  fit_label text NOT NULL CHECK (fit_label IN ('strong','conditional','limited')),
  rationale text NOT NULL,
  limitations text NOT NULL DEFAULT '',
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  cautions jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_confidence numeric(5,4) NOT NULL CHECK (evidence_confidence BETWEEN 0 AND 1),
  evidence_coverage numeric(5,4) NOT NULL CHECK (evidence_coverage BETWEEN 0 AND 1),
  source_count integer NOT NULL,
  evidence_count integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (editorial_run_id,product_version_id)
);

CREATE INDEX IF NOT EXISTS pipeline_runs_started_idx ON pipeline_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS editorial_runs_started_idx ON editorial_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS editorial_scores_run_score_idx ON editorial_scores(editorial_run_id,tg_score DESC);
