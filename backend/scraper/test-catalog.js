import 'dotenv/config';

const BASE =
  process.env.STORE_BASE_URL ||
  'https://demo.inelabteamdev.com';

const url =
  `${BASE}/api/catalog?page=1&pageSize=20`;

console.log('Fetching:', url);

const response = await fetch(url, {
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: `${BASE}/`,
  },
});

console.log('STATUS:', response.status);

const text = await response.text();

console.log('\nRAW RESPONSE:\n');
console.log(text.slice(0, 10000));