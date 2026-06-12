# gear-intel

TrailGenic Gear Intelligence is a small web tool for generating gear-analysis JSON by synthesizing public review signal through the TrailGenic longevity lens. The app lets an operator queue hiking products, choose a gear category and public-source set, run analysis, and export the resulting scored dataset as JSON, Markdown, or Schema.org-style MCP-ready JSON.

## Architecture

- `index.html` is the static browser application, including the queue UI, source/category selectors, report rendering, and export helpers.
- `api/analyze.js` is a Vercel Serverless Function that accepts a locked-down application-specific request body, builds the TrailGenic Gear Intelligence Engine prompt server-side, and calls the Anthropic Messages API.
- The browser never sends Anthropic request parameters directly and never receives raw Anthropic response envelopes. `/api/analyze` returns the parsed gear-analysis JSON object directly.

## Environment

Set this environment variable in Vercel before running analysis:

```bash
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## Model

The analysis route currently uses:

```text
claude-sonnet-4-6
```

## `/api/analyze` contract

### Request

`POST /api/analyze` accepts only this JSON shape:

```json
{
  "gear_name": "Osprey Talon 22",
  "category": "Backpacks",
  "sources": ["OutdoorGearLab"]
}
```

Validation rules:

- `gear_name`: non-empty string, maximum 120 characters.
- `category`: one of `Backpacks`, `Trail Shoes`, `Insulation`, `Trekking Poles`, `Electrolytes`, `Hydration`, `Shell / Rain`, or `Headlamps`.
- `sources`: 1–5 strings, each one of `OutdoorGearLab`, `REI Expert Reviews`, `Reddit r/ultralight`, `Trailspace`, or `Switchback Travel`.

Any other body shape, including an Anthropic-API-shaped body with `model` or `messages`, is rejected with `400`.

### Response

On success, `/api/analyze` returns the parsed gear-analysis JSON object directly, for example:

```json
{
  "product_name": "Osprey Talon 22",
  "category": "Backpacks",
  "tg_composite_score": 78,
  "scores": [
    { "label": "Metabolic Load", "short": "Met", "value": 82, "note": "brief field note" }
  ],
  "tg_verdict": "...",
  "field_signals": [],
  "recommendations": [],
  "tg_protocol_note": "...",
  "sources_used": ["OutdoorGearLab"],
  "analysis_date": "June 12, 2026",
  "data_note": "Public review synthesis. TG scores reflect longevity-protocol weighting, not consumer average."
}
```

Errors use JSON responses such as `{ "error": "Invalid request body" }`, `{ "error": "Upstream error", "status": 502 }`, or `{ "error": "Malformed model output" }`.

## Dataset save endpoint

`/api/save-dataset` is intentionally unimplemented. The “Push to MCP KV” path is feature-flagged off in the UI, so operators should use the JSON, Markdown, or MCP Schema copy/export actions until the dataset persistence endpoint is wired.
