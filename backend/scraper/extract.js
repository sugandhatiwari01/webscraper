export function normalizePrice(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/,/g, '').replace(/[^\d.]/g, '');
  if (!cleaned) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function normalizeStock(value) {
  const text = String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!text) return 'unknown';

  if (/out of stock|sold out|unavailable|currently unavailable/.test(text)) {
    return 'out_of_stock';
  }
  if (/low stock|only .* left|few left|limited stock/.test(text)) {
    return 'low_stock';
  }
  if (/in stock|available|add to cart|buy now/.test(text)) {
    return 'in_stock';
  }
  return 'unknown';
}

export function validateProductData({ price, stock_status }) {
  if (price == null || !Number.isFinite(price) || price < 0) {
    throw new Error('VALIDATION_ERROR: price was not extracted as a valid number');
  }
  if (!['in_stock', 'out_of_stock', 'low_stock', 'unknown'].includes(stock_status)) {
    throw new Error('VALIDATION_ERROR: unrecognized stock state');
  }
}

export function extractFromText($) {
  const priceCandidates = [
    '[itemprop="price"]',
    'meta[property="product:price:amount"]',
    '.price',
    '[class*="price" i]',
    '[data-price]'
  ];

  let priceRaw = null;
  for (const selector of priceCandidates) {
    const el = $(selector).first();
    if (!el.length) continue;
    priceRaw = el.attr('content') ?? el.attr('data-price') ?? el.text();
    if (normalizePrice(priceRaw) != null) break;
  }

  const stockText = [
    '[itemprop="availability"]',
    '[class*="stock" i]',
    '[class*="availability" i]',
    '[data-stock]'
  ].map(s => $(s).first().attr('content') ?? $(s).first().attr('data-stock') ?? $(s).first().text())
   .filter(Boolean)
   .join(' ');

  return {
    price: normalizePrice(priceRaw),
    stock_status: normalizeStock(stockText),
    title: $('h1').first().text().replace(/\s+/g, ' ').trim() || $('title').text().trim()
  };
}
