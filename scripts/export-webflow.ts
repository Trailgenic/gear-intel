import { closePool } from '../src/db/client.js';
import { renderWebflowEmbed } from '../src/publishing/webflow.js';
import { getReportForExport } from '../src/publishing/report.js';

async function main() {
  process.stdout.write(`${renderWebflowEmbed(await getReportForExport())}\n`);
}

main().finally(closePool).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
