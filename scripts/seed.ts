import { closePool } from '../src/db/client.js';
import { seedDatabase } from '../src/db/seed.js';

async function main() {
  const result = await seedDatabase();
  console.log(`Seeded ${result.rubrics} rubrics and ${result.candidates} legacy-unverified product candidates.`);
}

main().finally(closePool).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
