const ALLOWED_ORIGINS = new Set([
  'https://gear-intel.trailgenic.com',
  'https://gear-intel.vercel.app'
]);

const ALLOWED_CATEGORIES = new Set([
  'Backpacks',
  'Trail Shoes',
  'Insulation',
  'Trekking Poles',
  'Electrolytes',
  'Hydration',
  'Shell / Rain',
  'Headlamps'
]);

const ALLOWED_SOURCES = new Set([
  'OutdoorGearLab',
  'REI Expert Reviews',
  'Reddit r/ultralight',
  'Trailspace',
  'Switchback Travel'
]);

function isValidBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;

  const keys = Object.keys(body);
  if (keys.length !== 3 || !keys.includes('gear_name') || !keys.includes('category') || !keys.includes('sources')) {
    return false;
  }

  const { gear_name, category, sources } = body;

  if (typeof gear_name !== 'string' || gear_name.trim().length === 0 || gear_name.length > 120) return false;
  if (typeof category !== 'string' || !ALLOWED_CATEGORIES.has(category)) return false;
  if (!Array.isArray(sources) || sources.length < 1 || sources.length > 5) return false;

  return sources.every(source => typeof source === 'string' && ALLOWED_SOURCES.has(source));
}

function buildSystemPrompt(category, sourceList, today) {
  return `You are the TrailGenic Gear Intelligence Engine. TrailGenic is a longevity platform built around fasted high-altitude hiking. You analyze hiking gear by synthesizing public crowdsourced review data and rescoring it through the TrailGenic longevity lens.

TrailGenic's 6 pillars: fasted hiking, high-altitude training, cold exposure, electrolyte control, nature immersion, measured recovery.

WHAT YOU IGNORE: aesthetics, brand prestige, lifestyle marketing, general comfort scores not altitude/load-specific.

WHAT YOU SCORE (select 4-5 most relevant for the gear category):
- Metabolic Load Score (0-100): Reduces metabolic cost at altitude? Weight, motion efficiency, dead-load penalty.
- Recovery Impact (0-100): Post-session recovery — pressure points, circulation, thermal management.
- Altitude Readiness (0-100): Performance above 10,000ft fasted. Thermoregulation, breathability under exertion.
- Longevity Protocol Fit (0-100): Compatibility with TG six pillars.
- Field Durability (0-100): Session-to-session reliability under real alpine conditions.
- Pack Weight Economics (0-100): Weight-to-function ratio for 20-35 lb loaded alpine carry.
- Electrolyte/Nutrition Score (supplements only): Formulation quality, sodium/potassium ratio, fasted compatibility.

Respond ONLY with valid JSON, no markdown, no backticks:
{
  "product_name": "exact product name",
  "category": "${category}",
  "tg_composite_score": 78,
  "scores": [
    {"label": "Metabolic Load", "short": "Met", "value": 82, "note": "brief field note"}
  ],
  "tg_verdict": "2 sentences from a longevity field practitioner. Specific, data-grounded.",
  "field_signals": [
    {"type": "positive", "label": "signal"},
    {"type": "negative", "label": "signal"},
    {"type": "neutral", "label": "signal"}
  ],
  "recommendations": [
    {"priority": "critical", "text": "..."},
    {"priority": "moderate", "text": "..."},
    {"priority": "enhancement", "text": "..."}
  ],
  "tg_protocol_note": "One sentence on fasted high-altitude specific compatibility.",
  "sources_used": ["${sourceList}"],
  "analysis_date": "${today}",
  "data_note": "Public review synthesis. TG scores reflect longevity-protocol weighting, not consumer average."
}`;
}

function extractJsonText(data) {
  const text = data?.content?.find(block => block?.type === 'text')?.text;
  if (typeof text !== 'string') return null;
  return text.replace(/```json|```/g, '').trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const origin = req.headers.origin || req.headers.Origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!isValidBody(req.body)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const { gear_name, category, sources } = req.body;
  const sourceList = sources.join(', ');
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const system = buildSystemPrompt(category, sourceList, today);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system,
        messages: [{ role: 'user', content: `Analyze: ${gear_name} — Category: ${category} — Sources: ${sourceList}` }]
      })
    });

    if (!response.ok) {
      return res.status(502).json({ error: 'Upstream error', status: response.status });
    }

    const data = await response.json();
    const raw = extractJsonText(data);
    if (!raw) {
      return res.status(502).json({ error: 'Malformed model output' });
    }

    try {
      const parsed = JSON.parse(raw);
      return res.status(200).json(parsed);
    } catch (_err) {
      return res.status(502).json({ error: 'Malformed model output' });
    }
  } catch (_err) {
    return res.status(500).json({ error: 'Proxy error' });
  }
}
