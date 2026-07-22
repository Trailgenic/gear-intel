import { closePool } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';

async function main() {
  const result = await runMigrations();
  for (const file of result.applied) console.log(`Applied ${file}`);
  for (const file of result.skipped) console.log(`Skipped ${file} (already applied)`);
}

main().finally(closePool).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
