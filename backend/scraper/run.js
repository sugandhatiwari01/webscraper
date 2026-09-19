import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { scrapeTrackedProduct } from './scrape.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: products, error } = await supabase
  .from('tracked_products')
  .select('*')
  .eq('active', true);

if (error) throw error;

for (const product of products ?? []) {
  try {
    console.log(`Scraping ${product.name}`);
    console.log(await scrapeTrackedProduct(product, supabase));
  } catch (error) {
    console.error(error.message);
  }
}
