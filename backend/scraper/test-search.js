import 'dotenv/config';
import { searchStoreProducts } from './store.js';

const query = process.argv[2] || 'docking';

try {
  console.log(`Searching for: "${query}"`);

  const results = await searchStoreProducts(query);

  console.dir(results, { depth: null });

  console.log(`\nFound ${results.length} result(s).`);
} catch (error) {
  console.error('SEARCH FAILED:');
  console.error(error);
  process.exit(1);
}