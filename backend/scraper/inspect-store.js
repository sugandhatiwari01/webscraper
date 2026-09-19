import 'dotenv/config';

const BASE =
  process.env.STORE_BASE_URL ||
  'https://demo.inelabteamdev.com';

const html = await fetch(BASE).then((r) => r.text());

const scripts = [
  ...html.matchAll(
    /<script[^>]+src=["']([^"']+)["']/gi
  ),
].map((m) => m[1]);

console.log("Scripts:");
console.log(scripts);

for (const src of scripts) {
  const url = new URL(src, BASE).toString();

  console.log("\nFetching:", url);

  const js = await fetch(url).then((r) => r.text());

  console.log("Size:", js.length);

  const patterns = [
    /\/api\/[^"`'\\]+/g,
    /fetch\([^)]{0,300}/g,
    /search[^"'`]{0,100}/gi,
    /products[^"'`]{0,100}/gi,
  ];

  for (const pattern of patterns) {
    const matches = js.match(pattern);

    if (matches) {
      console.log("\nMATCHES:");
      console.log(
        [...new Set(matches)].slice(0, 50)
      );
    }
  }
}