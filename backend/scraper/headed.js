import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { scrapeTrackedProduct } from './scrape.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const url = process.env.HEADED_PRODUCT_URL;
if (!url) throw new Error('Set HEADED_PRODUCT_URL in backend/.env');

const product = {
  id: '00000000-0000-0000-0000-000000000000',
  name: 'Headed recording product',
  url
};

console.log('Launching headed scraper...');
console.log(await scrapeTrackedProduct(product, supabase, { headed: true }));
