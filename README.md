# TrailGenic Gear Intelligence

TrailGenic Gear Intelligence is a versioned product-and-evidence database for identifying gear that fits the TrailGenic Method under explicit conditions. TG Score is a subjective TrailGenic editorial judgment, not a universal or independently reproducible measurement.

Version 2 replaces the original one-shot model scoring page with an unattended, auditable workflow:

1. Discover current and trending product candidates using sourced web results.
2. Automatically admit source-qualified candidates into a normalized, versioned product catalog; ambiguous candidates are held.
3. Retrieve real source pages from approved domains.
4. Extract source-grounded claims into a strict schema. Each claim retains a short supporting excerpt.
5. Automatically validate source identity, exact excerpts, and claim basis; weak or failed inputs are excluded and logged.
6. Apply the subjective TrailGenic editorial lens to the sourced evidence with a versioned model and prompt.
7. Keep evidence confidence separate from protocol fit.
8. Publish an immutable editorial report automatically, with evidence confidence kept separate from TG Score.
9. Generate a complete Webflow HTML Code Embed from the published snapshot.

The 49 products from the original application are retained as `candidate` records with the model version `q2-2026-seed`. They are legacy-unverified starting points, not a catalog limit. Weekly discovery can propose newer or trending products in every category.

## System boundaries

- The extraction model classifies sourced claims. A separate editorial model assigns the subjective TG Score from those claims.
- Trend score measures current attention and freshness only. It never contributes to TrailGenic fit.
- Only automatically validated, exact-source evidence enters editorial scoring.
- Source failures and insufficiently supported products are excluded without blocking the run.
- Historical evidence, assessments, reviews, rubrics, runs, and reports are retained.
- Webflow remains a publication target. This repository never creates Webflow native/WHTML element trees.

## Architecture

```text
Current discovery ──> automatic source gate ──> product/version catalog
                                                    │
Allowlisted retrieval ──> exact-quote extraction ───┤
                                                    │
TrailGenic editorial lens ──> subjective TG Score ──┘
                                  │
                       immutable report snapshot
                          │                 │
                     public API       Webflow embed
```

## Stack

- TypeScript and Node.js 22
- PostgreSQL
- Vercel serverless functions and cron
- Provider-agnostic evidence model interface
- OpenAI Responses API adapter using Structured Outputs
- GPT-5.6 Luna by default for extraction/discovery; configurable by environment
- Zod boundary validation
- Vitest

No live model or database call is required for unit tests.

## Data model

The initial migrations define:

- `categories`
- `products`
- `product_versions`
- `sources`
- `source_snapshots`
- `evidence_extractions`
- `evidence_items`
- `rubric_versions`
- `assessment_runs`
- `assessments`
- `assessment_dimensions`
- `assessment_evidence`
- `review_events`
- `report_snapshots`
- `discovery_runs`
- `product_candidates`

Every source snapshot has a content hash. Every assessment records its run, product version, rubric version, evidence set, fit, confidence, coverage, and review state.

## Local setup

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm test
npm run typecheck
```

Required production variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string; preferred portable name |
| `POSTGRES_URL` | Vercel Postgres connection string; used automatically when `DATABASE_URL` is absent |
| `OPENAI_API_KEY` | Server-side model access; never exposed to the browser |
| `ADMIN_API_TOKEN` | Bearer token required for every mutating or private operator API |
| `CRON_SECRET` | Authorization for the unattended pipeline and freshness job |
| `SOURCE_HOST_ALLOWLIST` | Comma-separated retrieval domains |

Optional model routing variables:

| Variable | Default |
|---|---|
| `EVIDENCE_MODEL_PROVIDER` | `openai` |
| `OPENAI_EXTRACTION_MODEL` | `gpt-5.6-luna` |
| `OPENAI_DISCOVERY_MODEL` | falls back to extraction model |
| `OPENAI_NARRATIVE_MODEL` | `gpt-5.6-luna` |
| `OPENAI_REVIEW_MODEL` | `gpt-5.6-terra` |
| `OPENAI_EDITORIAL_MODEL` | falls back to extraction model |

Pin dated model snapshots when the provider offers them and record the resolved model on every run.

## API workflow

The default production path is `/api/jobs/pipeline`. It applies pending migrations, seeds required records, discovers products when due, admits source-qualified candidates, imports and validates evidence, assigns the TrailGenic editorial score, and publishes the current snapshot. Individual operator endpoints remain available for diagnostics and exceptional corrections; they are not routine workflow steps.

Public endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Database health and service version |
| `GET` | `/api/products` | Catalog list; optional `?category=` filter |
| `GET` | `/api/reports/latest` | Latest immutable editorial report snapshot |
| `GET` | `/api/pipeline/status` | Latest unattended pipeline stage, metrics, and exceptions |

Operator endpoints require `Authorization: Bearer $ADMIN_API_TOKEN`:

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/admin/initialize` | Idempotently apply migrations and seed rubrics/candidates |
| `GET` | `/api/discovery/candidates` | Review pending current/trending candidates |
| `POST` | `/api/discovery/review` | Bulk accept, hold, reject, or deduplicate candidates with correction overlays |
| `POST` | `/api/discovery/promote` | Promote a reviewed candidate to the catalog |
| `POST` | `/api/products` | Add or update a product version manually |
| `POST` | `/api/evidence/import` | Retrieve a real source and extract claims |
| `GET` | `/api/evidence/queue` | Inspect queued, completed, and failed source imports |
| `GET` | `/api/evidence/list?productVersionId=` | Inspect extracted and reviewed evidence |
| `POST` | `/api/evidence/verify` | Verify, reject, or mark evidence conflicting |
| `POST` | `/api/assessments/create` | Deterministically assess from verified evidence |
| `GET` | `/api/assessments/list?status=pending` | Inspect assessments by review state |
| `POST` | `/api/assessments/review` | Approve, reject, or request changes |
| `POST` | `/api/reports/publish` | Publish approved assessments as a snapshot |

Scheduled endpoints use `Authorization: Bearer $CRON_SECRET`:

| Endpoint | Cadence | Purpose |
|---|---|---|
| `/api/jobs/freshness` | Weekly | Mark products stale when verified evidence ages beyond 180 days |
| `/api/jobs/pipeline` | Daily | Initialize, discover when due, collect evidence, apply TG editorial scoring, and publish |

## Scoring and confidence

Each of the eight categories has a separate rubric in `src/rubrics/index.ts`. Weights total 1.0 within a category. Cross-category scores are not treated as directly comparable.

Evidence records carry:

- signal: positive, negative, neutral, or conditional
- strength: 1–5
- source reliability: 0–1
- protocol applicability: 0–1
- verification state

Application code calculates evidence coverage, source diversity, and evidence confidence. The editorial model then applies TrailGenic's category priorities and assigns the subjective TG Score. A product needs at least two exact-product sources, including one independent source, to enter the scored slate; insufficiently sourced products are excluded and logged instead of blocking publication.

The numeric TG Score is the TrailGenic house judgment. The labels are fixed display bands: `strong` for 75–100, `conditional` for 55–74, and `limited` for 0–54. Evidence confidence describes the factual support behind the inputs and never substitutes for or validates that editorial score.

## Publishing to Webflow

After a current editorial snapshot exists:

```bash
npm run export:webflow > gear-hub-embed.html
```

The command emits one complete, versioned HTML Code Embed. It does not edit Webflow, create branches, create `tggi` elements, or publish anything.

The repository landing page reads `/api/reports/latest` and displays the latest editorial index. Before the first completed snapshot it intentionally shows an awaiting-data state.

## Security and provenance

- All writes require a server-side bearer secret.
- Retrieval permits HTTPS allowlisted hosts only and rejects IP/private-network targets.
- Retrieval has time, size, redirect, and content-type limits.
- Models receive cleaned source text rather than arbitrary browser request bodies.
- Model responses must pass strict JSON Schema and Zod validation.
- Unknown rubric dimensions are rejected.
- Public report payloads retain the source set, editorial model, prompt version, evidence cutoff, and explicit subjective-methodology disclosure.
- Dynamic website and Webflow output is HTML-escaped.
- API keys and database credentials are excluded from source control.

## Validation

```bash
npm run typecheck
npm test
npm run build
```

Tests cover rubric integrity, source controls, claim calibration, evidence-confidence calculations, boundary validation, and Webflow output escaping.
