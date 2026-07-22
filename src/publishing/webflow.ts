interface PublicProduct {
  name: string;
  categoryKey: string;
  fitScore: number | null;
  confidence: number;
  evidenceCoverage: number;
  evidenceState: string;
  fitLabel: string;
  summary: string;
  limitations: string;
  sources?: Array<{ url: string; title?: string | null; publisher: string }>;
}

interface PublicReport {
  title: string;
  quarter: string;
  evidenceCutoff: string;
  rubricVersion: string;
  products: PublicProduct[];
}

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character] ?? character));

export function renderWebflowEmbed(report: PublicReport): string {
  const cards = report.products.map((product) => {
    const sources = (product.sources ?? []).map((source) => `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title || source.publisher)}</a>`).join(' · ');
    return `<article class="tg-gi-card" data-category="${esc(product.categoryKey)}">
  <div class="tg-gi-card__top"><div><span>${esc(product.categoryKey.replace(/-/g, ' '))}</span><h3>${esc(product.name)}</h3></div><strong>${product.fitScore ?? '—'}</strong></div>
  <p>${esc(product.summary)}</p>
  <small>${esc(product.fitLabel)} TrailGenic fit · ${esc(product.evidenceState)} evidence · ${Math.round(product.confidence * 100)}% evidence confidence</small>
  ${sources ? `<div class="tg-gi-card__sources">Sources: ${sources}</div>` : ''}
</article>`;
  }).join('\n');
  return `<!-- TrailGenic Gear Intelligence Hub Embed v2.0.0 -->
<section class="tg-gi" aria-labelledby="tg-gi-title">
  <style>
    .tg-gi{--ink:#07130f;--panel:#0d2119;--line:#224739;--mint:#91efbd;background:var(--ink);color:#f3f1e9;padding:clamp(28px,5vw,72px);font-family:Inter,system-ui,sans-serif}.tg-gi *{box-sizing:border-box}.tg-gi a{color:var(--mint)}.tg-gi h2{font:400 clamp(42px,7vw,84px)/.95 Georgia,serif;margin:10px 0}.tg-gi__meta{color:#9db3a9;margin:0 0 36px}.tg-gi__grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.tg-gi-card{border:1px solid var(--line);background:var(--panel);padding:22px}.tg-gi-card__top{display:flex;justify-content:space-between;gap:18px}.tg-gi-card span,.tg-gi-card small{color:#9db3a9;text-transform:uppercase;letter-spacing:.1em;font-size:10px}.tg-gi-card h3{font:400 24px/1.05 Georgia,serif;margin:7px 0}.tg-gi-card strong{color:var(--mint);font:400 42px/1 Georgia,serif}.tg-gi-card p{line-height:1.5;color:#cfddd6}.tg-gi-card__sources{border-top:1px solid var(--line);margin-top:14px;padding-top:10px;font-size:11px;color:#9db3a9}@media(max-width:900px){.tg-gi__grid{grid-template-columns:1fr 1fr}}@media(max-width:620px){.tg-gi__grid{grid-template-columns:1fr}}
  </style>
  <div class="tg-gi__eyebrow">TrailGenic™ Gear Intelligence · ${esc(report.quarter)}</div>
  <h2 id="tg-gi-title">${esc(report.title)}</h2>
  <p class="tg-gi__meta">${report.products.length} editorial assessments · Evidence through ${esc(report.evidenceCutoff)} · ${esc(report.rubricVersion)}</p>
  <p class="tg-gi__meta">TG Score is TrailGenic’s subjective editorial assessment—not a universal or independently reproducible performance measurement.</p>
  <div class="tg-gi__grid">${cards}</div>
</section>
<!-- /TrailGenic Gear Intelligence Hub Embed v2.0.0 -->`;
}
