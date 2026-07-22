import { closePool } from '../src/db/client.js';
import { getLatestReport } from '../src/db/queries.js';
import { renderWebflowEmbed } from '../src/publishing/webflow.js';

async function main() {
  const report = await getLatestReport();
  if (!report) throw new Error('No approved report snapshot is available');
  process.stdout.write(`${renderWebflowEmbed(report as Parameters<typeof renderWebflowEmbed>[0])}\n`);
}

main().finally(closePool).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
