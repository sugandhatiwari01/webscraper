import 'dotenv/config';

const BASE =
  process.env.STORE_BASE_URL ||
  'https://demo.inelabteamdev.com';

const bundleUrl =
  `${BASE}/assets/index-B9UiQq4X.js`;

const response = await fetch(bundleUrl);

if (!response.ok) {
  throw new Error(
    `Failed to download bundle: HTTP ${response.status}`
  );
}

const text = await response.text();

console.log('Bundle size:', text.length);

const terms = [
  '/api/search',
  'api/search',
  '/search',
  'search?',
  '?q=',
  '&q=',
  'query=',
  'keyword=',
  'searchTerm',
  'searchQuery',
  'catalog?'
];

for (const term of terms) {

  console.log(
    `\n========== ${term} ==========`
  );

  let start = 0;
  let found = 0;

  while (true) {

    const index =
      text.indexOf(term, start);

    if (index === -1) {
      break;
    }

    found++;

    const from =
      Math.max(0, index - 250);

    const to =
      Math.min(text.length, index + 500);

    console.log(
      text.slice(from, to)
    );

    start = index + term.length;

    if (found >= 5) {
      break;
    }
  }

  if (found === 0) {
    console.log('Not found');
  }
}