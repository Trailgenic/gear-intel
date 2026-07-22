import { categoryLabels, displayQuarter, type GearReport } from './report.js';

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character] ?? character));

function sourceLine(report: GearReport): string {
  const sources = [...new Set(report.products.flatMap((product) => product.sources.map((source) => source.publisher)))];
  return sources.length ? sources.join(', ') : 'OutdoorGearLab, REI Expert Reviews, Reddit r/ultralight';
}

export function renderWebflowEmbed(report: GearReport): string {
  const products = [...report.products].sort((a,b) => b.fitScore-a.fitScore || a.name.localeCompare(b.name));
  let previousScore: number | null = null;
  let previousRank = 0;
  const rows = products.map((product,index) => {
    const rank = product.fitScore === previousScore ? previousRank : index + 1;
    previousScore = product.fitScore;
    previousRank = rank;
    return `<tr>
      <td>${rank}</td>
      <td><strong>${esc(product.name)}</strong><span>${esc(product.summary)}</span></td>
      <td><em>${esc(categoryLabels[product.categoryKey] ?? product.categoryKey)}</em></td>
      <td><b>${product.fitScore}</b></td>
    </tr>`;
  }).join('\n');
  const shownQuarter = displayQuarter(report.quarter);
  return `<!-- TrailGenic Gear Intelligence — Full Webflow HTML Embed v3.0.0 -->
<section class="tg-gear-intel" aria-labelledby="tg-gear-intel-title">
  <style>
    .tg-gear-intel{--tg-ink:#10100d;--tg-paper:#fff;--tg-soft:#f6f4ee;--tg-line:#ddd8cc;--tg-green:#176532;--tg-gold:#c58e35;color:var(--tg-ink);background:var(--tg-paper);font-family:Georgia,'Times New Roman',serif;padding:clamp(28px,5vw,72px) 0}.tg-gear-intel *{box-sizing:border-box}.tg-gi-wrap{width:min(1120px,calc(100% - 36px));margin:auto}.tg-gi-kicker{font:500 10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:#69716d}.tg-gear-intel h1{font:400 clamp(38px,6vw,66px)/1.02 Georgia,serif;letter-spacing:-.035em;margin:24px 0 14px}.tg-gi-lede{border-left:2px solid var(--tg-gold);padding:2px 0 2px 18px;max-width:900px;font-size:clamp(16px,2.1vw,22px);line-height:1.55;font-style:italic;color:#45433e}.tg-gi-meta{font:400 10px/1.8 ui-monospace,SFMono-Regular,Menlo,monospace;color:#737871;margin:28px 0 32px;padding-bottom:26px;border-bottom:1px solid var(--tg-line)}.tg-gear-intel h2{font:400 clamp(28px,4vw,40px)/1.1 Georgia,serif;margin:0 0 14px}.tg-gi-table-wrap{overflow-x:auto}.tg-gear-intel table{border-collapse:collapse;width:100%;table-layout:fixed}.tg-gear-intel thead{background:var(--tg-soft)}.tg-gear-intel th{font:600 9px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:#74756f;text-align:left;padding:12px 14px;border-bottom:1px solid var(--tg-line)}.tg-gear-intel th:nth-child(1){width:7%}.tg-gear-intel th:nth-child(2){width:57%}.tg-gear-intel th:nth-child(3){width:22%}.tg-gear-intel th:nth-child(4){width:14%}.tg-gear-intel td{padding:15px 14px;border-bottom:1px solid #e8e4db;vertical-align:top;font-size:14px}.tg-gear-intel td strong{display:block;font-weight:400;font-size:16px}.tg-gear-intel td span{display:block;margin-top:7px;color:#6d6a63;font-size:12px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.tg-gear-intel td em{display:inline-block;background:#f0eee7;padding:4px 7px;font:400 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#6d706b;font-style:normal}.tg-gear-intel td b{color:var(--tg-green);font-size:19px;font-weight:400}.tg-gi-note{margin-top:28px;padding:18px;background:var(--tg-soft);font-size:13px;line-height:1.55;color:#5f5c55}.tg-gi-note strong{color:var(--tg-green)}@media(max-width:700px){.tg-gear-intel th:nth-child(2){width:55%}.tg-gear-intel th:nth-child(3){width:28%}.tg-gear-intel th:nth-child(1){width:8%}.tg-gear-intel th:nth-child(4){width:12%}.tg-gear-intel td,.tg-gear-intel th{padding:11px 8px}.tg-gear-intel td span{display:none}.tg-gear-intel td strong{font-size:14px}}
  </style>
  <div class="tg-gi-wrap">
    <div class="tg-gi-kicker">By Mike Ye × Ella (AI) · TrailGenic™ Gear Intelligence · ${esc(shownQuarter)}</div>
    <h1 id="tg-gear-intel-title">Gear Intelligence Report — ${esc(shownQuarter)}</h1>
    <p class="tg-gi-lede">${products.length} products scored through the TrailGenic longevity lens. Not consumer preference—fasted high-altitude performance, metabolic efficiency, and protocol fit.</p>
    <div class="tg-gi-meta">Analysis date: ${esc(report.evidenceCutoff)} &nbsp;·&nbsp; Products: ${products.length} &nbsp;·&nbsp; Categories: ${new Set(products.map((product) => product.categoryKey)).size} &nbsp;·&nbsp; Sources: ${esc(sourceLine(report))} &nbsp;·&nbsp; Dataset: mcp.trailgenic.com/datasets/gear/intel</div>
    <h2>Full Rankings</h2>
    <div class="tg-gi-table-wrap">
      <table>
        <thead><tr><th>#</th><th>Product</th><th>Category</th><th>TG Score</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="tg-gi-note"><strong>Methodology:</strong> TG Scores are TrailGenic’s subjective house assessment, applying our longevity, fasted-hiking, altitude, recovery, and protocol-fit priorities to public product and review signals.</div>
  </div>
</section>
<!-- /TrailGenic Gear Intelligence — Full Webflow HTML Embed v3.0.0 -->`;
}
