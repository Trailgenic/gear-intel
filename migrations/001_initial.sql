CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  product_family text NOT NULL,
  category_id uuid NOT NULL REFERENCES categories(id),
  status text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','active','stale','discontinued','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand, product_family, category_id)
);

CREATE TABLE IF NOT EXISTS product_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  model_version text NOT NULL,
  display_name text NOT NULL,
  manufacturer_url text,
  introduced_at date,
  discontinued_at date,
  specifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  specifications_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, model_version)
);

CREATE TABLE IF NOT EXISTS sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL UNIQUE,
  publisher text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('manufacturer','expert_review','community','scientific','operator_note')),
  title text,
  published_at date,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_retrieved_at timestamptz,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS source_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  content_hash text NOT NULL,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  evidence_cutoff date,
  http_status integer,
  extraction_model text,
  prompt_version text,
  input_tokens integer,
  output_tokens integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (source_id, content_hash)
);

CREATE TABLE IF NOT EXISTS evidence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_version_id uuid NOT NULL REFERENCES product_versions(id) ON DELETE CASCADE,
  source_snapshot_id uuid NOT NULL REFERENCES source_snapshots(id) ON DELETE CASCADE,
  dimension_key text NOT NULL,
  claim text NOT NULL,
  excerpt text NOT NULL CHECK (length(excerpt) <= 500),
  signal text NOT NULL CHECK (signal IN ('positive','negative','neutral','conditional')),
  strength smallint NOT NULL CHECK (strength BETWEEN 1 AND 5),
  reliability numeric(4,3) NOT NULL CHECK (reliability BETWEEN 0 AND 1),
  applicability numeric(4,3) NOT NULL CHECK (applicability BETWEEN 0 AND 1),
  limitations text NOT NULL DEFAULT '',
  verification_state text NOT NULL DEFAULT 'unverified' CHECK (verification_state IN ('unverified','verified','conflicting','rejected')),
  verified_by text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rubric_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES categories(id),
  version text NOT NULL,
  definition jsonb NOT NULL,
  active boolean NOT NULL DEFAULT false,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_rubric_per_category
  ON rubric_versions(category_id) WHERE active = true;

CREATE TABLE IF NOT EXISTS assessment_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type text NOT NULL CHECK (run_type IN ('manual','weekly_refresh','quarterly','reassessment')),
  quarter text,
  evidence_cutoff date NOT NULL,
  code_version text NOT NULL,
  provider text NOT NULL,
  extraction_model text NOT NULL,
  review_model text,
  prompt_version text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','complete','partial','failed')),
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES assessment_runs(id),
  product_version_id uuid NOT NULL REFERENCES product_versions(id),
  rubric_version_id uuid NOT NULL REFERENCES rubric_versions(id),
  fit_score numeric(6,2),
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  evidence_coverage numeric(5,4) NOT NULL CHECK (evidence_coverage BETWEEN 0 AND 1),
  evidence_state text NOT NULL CHECK (evidence_state IN ('verified','supported','preliminary','conflicting','insufficient')),
  fit_label text NOT NULL CHECK (fit_label IN ('strong','conditional','limited','insufficient')),
  summary text NOT NULL DEFAULT '',
  limitations text NOT NULL DEFAULT '',
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','approved','changes_requested','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, product_version_id)
);

CREATE TABLE IF NOT EXISTS assessment_dimensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  dimension_key text NOT NULL,
  label text NOT NULL,
  score numeric(6,2),
  confidence numeric(5,4) NOT NULL,
  evidence_count integer NOT NULL,
  source_count integer NOT NULL,
  UNIQUE (assessment_id, dimension_key)
);

CREATE TABLE IF NOT EXISTS assessment_evidence (
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  evidence_item_id uuid NOT NULL REFERENCES evidence_items(id),
  PRIMARY KEY (assessment_id, evidence_item_id)
);

CREATE TABLE IF NOT EXISTS review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('approved','changes_requested','rejected')),
  reviewer text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  quarter text NOT NULL,
  evidence_cutoff date NOT NULL,
  rubric_version text NOT NULL,
  approved_by text NOT NULL,
  payload jsonb NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz
);

CREATE INDEX IF NOT EXISTS products_category_status_idx ON products(category_id, status);
CREATE INDEX IF NOT EXISTS evidence_product_dimension_idx ON evidence_items(product_version_id, dimension_key);
CREATE INDEX IF NOT EXISTS evidence_verification_idx ON evidence_items(verification_state);
CREATE INDEX IF NOT EXISTS assessments_product_created_idx ON assessments(product_version_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_quarter_idx ON report_snapshots(quarter, published_at DESC);
