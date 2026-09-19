import { chromium } from 'playwright';

const BASE_URL =
  process.env.STORE_BASE_URL ||
  'https://demo.inelabteamdev.com';

const TIMEOUT =
  Number(process.env.PLAYWRIGHT_TIMEOUT_MS) || 30000;

// =====================================================
// TEXT / NUMBER CLEANING
// =====================================================

function cleanMoney(value) {
  if (!value) return null;

  const cleaned = String(value)
    .normalize('NFKC')
    .replace(/\p{Cf}/gu, '')
    .replace(/,/g, '');

  const match =
    cleaned.match(/\d+(?:\.\d+)?/);

  return match ? Number(match[0]) : null;
}

function cleanDiscount(value) {
  if (!value) return null;

  const cleaned = String(value)
    .normalize('NFKC')
    .replace(/\p{Cf}/gu, '');

  const match =
    cleaned.match(/(\d+)\s*%\s*off/i);

  return match ? Number(match[1]) : null;
}

function cleanStock(value) {
  if (!value) return null;

  const cleaned = String(value)
    .normalize('NFKC')
    .replace(/\p{Cf}/gu, '');

  const match =
    cleaned.match(/\d+/);

  return match ? Number(match[0]) : null;
}

function cleanText(value) {
  if (!value) return null;

  return String(value)
    .normalize('NFKC')
    .replace(/\p{Cf}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// =====================================================
// WAIT HELPER
// =====================================================

function sleep(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}

// =====================================================
// REALISTIC MOUSE MOVEMENT
// =====================================================

async function stimulatePriceBlock(page, priceBlock) {
  const box =
    await priceBlock.boundingBox();

  if (!box) {
    throw new Error(
      'Price block has no bounding box'
    );
  }

  const centerX =
    box.x + box.width / 2;

  const centerY =
    box.y + box.height / 2;

  /*
   * Start outside the price block.
   */
  await page.mouse.move(
    Math.max(5, centerX - 220),
    Math.max(5, centerY - 120)
  );

  await sleep(150);

  /*
   * Move through the price block with
   * several distinct coordinates.
   */
  const moves = [
    [-140, -70],
    [-110, -40],
    [-80, -15],
    [-50, 20],
    [-20, -10],
    [10, 25],
    [40, -15],
    [70, 20],
    [100, -5],
    [120, 25],
    [80, 0],
    [40, 15],
    [0, 0]
  ];

  for (const [dx, dy] of moves) {
    await page.mouse.move(
      centerX + dx,
      centerY + dy,
      {
        steps: 4
      }
    );

    await sleep(100);
  }

  /*
   * Explicitly enter the price block.
   */
  await page.mouse.move(
    centerX,
    centerY,
    {
      steps: 5
    }
  );

  /*
   * The storefront requires dwell time.
   */
  await sleep(900);
}

// =====================================================
// CHECK WHETHER BUTTON IS ENABLED
// =====================================================

async function isRevealButtonEnabled(button) {
  try {
    const exists =
      await button.count();

    if (!exists) {
      return false;
    }

    return !(await button.isDisabled());

  } catch {
    return false;
  }
}

// =====================================================
// SCRAPE PRODUCT
// =====================================================
// =====================================================
// DISMISS COOKIE OVERLAY
// =====================================================

async function dismissCookieOverlay(page) {
  const overlay = page.locator('.cookie-overlay');

  if (await overlay.count() === 0) {
    return;
  }

  const visible = await overlay
    .isVisible()
    .catch(() => false);

  if (!visible) {
    return;
  }

  console.log(
    '[SCRAPER] Cookie overlay detected'
  );

  // Try to click a button inside the overlay.
  const buttons = overlay.locator('button');

  const count = await buttons.count();

  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);

    const buttonVisible =
      await button
        .isVisible()
        .catch(() => false);

    if (!buttonVisible) {
      continue;
    }

    try {
      await button.click({
        timeout: 2000
      });

      await page.waitForTimeout(300);

      const stillVisible =
        await overlay
          .isVisible()
          .catch(() => false);

      if (!stillVisible) {
        console.log(
          '[SCRAPER] Cookie overlay closed'
        );

        return;
      }

    } catch {
      // Try the next button.
    }
  }

  // If no usable button exists, prevent the overlay
  // from intercepting the scraper's pointer events.
  const stillVisible =
    await overlay
      .isVisible()
      .catch(() => false);

  if (stillVisible) {
    console.log(
      '[SCRAPER] Cookie overlay still visible; disabling pointer interception'
    );

    await overlay.evaluate(el => {
      el.style.pointerEvents = 'none';
    });
  }
}
export async function scrapeProduct(productId) {
  const startedAt = Date.now();

  let browser;

  try {
    /*
     * --------------------------------------------------
     * 1. Launch real Chrome
     * --------------------------------------------------
     */

  browser = await chromium.launch({
  headless: true
});

    const context =
      await browser.newContext();

    const page =
      await context.newPage();

    page.setDefaultTimeout(TIMEOUT);

    const productUrl =
      `${BASE_URL}/product/${productId}`;

    console.log(
      `[SCRAPER] Opening ${productUrl}`
    );

    /*
     * --------------------------------------------------
     * 2. Open product page
     * --------------------------------------------------
     */

    await page.goto(productUrl, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT
    });

    /*
     * --------------------------------------------------
     * 3. Fetch product metadata
     * --------------------------------------------------
     */

    const product =
      await page.evaluate(async id => {
        const response =
          await fetch(
            `/api/product/${id}`
          );

        if (!response.ok) {
          throw new Error(
            `Product API returned ${response.status}`
          );
        }

        return response.json();
      }, productId);

    /*
     * --------------------------------------------------
     * 4. Fetch dynamic layout
     * --------------------------------------------------
     */

    const layout =
      await page.evaluate(async () => {
        const response =
          await fetch('/api/layout');

        if (!response.ok) {
          throw new Error(
            `Layout API returned ${response.status}`
          );
        }

        return response.json();
      });

    /*
     * --------------------------------------------------
     * 5. Locate price block
     * --------------------------------------------------
     */

    const priceBlock =
      page.locator('.price-block');

    await priceBlock.waitFor({
      state: 'visible',
      timeout: TIMEOUT
    });

    await priceBlock.scrollIntoViewIfNeeded();

    /*
     * --------------------------------------------------
     * 6. Locate reveal button
     * --------------------------------------------------
     */

    const button =
      page.locator(
        '[aria-label="Reveal price"]'
      );

    await button.waitFor({
      state: 'visible',
      timeout: TIMEOUT
    });

    /*
     * --------------------------------------------------
     * 7. Try interaction multiple times
     * --------------------------------------------------
     *
     * Different products can require slightly
     * different interaction timing.
     */

    let buttonEnabled = false;

    const MAX_INTERACTION_ATTEMPTS = 4;

    for (
      let attempt = 1;
      attempt <= MAX_INTERACTION_ATTEMPTS;
      attempt++
    ) {
      console.log(
        `[SCRAPER] Price interaction attempt ${attempt}/${MAX_INTERACTION_ATTEMPTS}`
      );

      await stimulatePriceBlock(
        page,
        priceBlock
      );

      /*
       * Give React/storefront state time to update.
       */
      await sleep(300);

      buttonEnabled =
        await isRevealButtonEnabled(
          button
        );

      console.log(
        `[SCRAPER] Reveal button enabled: ${buttonEnabled}`
      );

      if (buttonEnabled) {
        break;
      }

      /*
       * Move away before trying again.
       */
      const box =
        await priceBlock.boundingBox();

      if (box) {
        await page.mouse.move(
          Math.max(5, box.x - 200),
          Math.max(5, box.y - 100)
        );
      }

      await sleep(500);
    }

    if (!buttonEnabled) {
      throw new Error(
        'Reveal price button remained disabled after interaction retries'
      );
    }

    /*
     * --------------------------------------------------
     * 8. Click reveal
     * --------------------------------------------------
     */

    console.log(
      '[SCRAPER] Revealing price...'
    );

    await button.click({
      noWaitAfter: true,
      timeout: 5000
    });

    /*
     * --------------------------------------------------
     * 9. Wait for price/challenge result
     * --------------------------------------------------
     */

// --------------------------------------------------
// Wait for the price flow to finish
// --------------------------------------------------

const PRICE_WAIT_TIMEOUT = 35000;

try {
  await page.waitForFunction(
    () => {
      const block =
        document.querySelector('.price-block');

      if (!block) {
        return false;
      }

      const text =
        block.innerText || '';

      /*
       * Initial state:
       *
       * Price hidden
       * Hover over the price area...
       *
       * We wait until that state disappears.
       */

      const stillHidden =
        text.includes('Price hidden');

      if (stillHidden) {
        return false;
      }

      /*
       * Any of these means the request has
       * progressed beyond the initial state.
       */

      return (
        text.includes('₹') ||
        text.includes('Loaded in') ||
        text.includes('Couldn’t load') ||
        text.includes('challenge_failed') ||
        text.includes('Refresh price') ||
        text.includes('REFRESH PRICE')
      );
    },
    {
      timeout: PRICE_WAIT_TIMEOUT,
      polling: 250
    }
  );

} catch (waitError) {

  /*
   * Don't immediately hide what happened.
   * Capture the actual storefront state.
   */

  const currentText =
    await priceBlock
      .innerText()
      .catch(() => '');

  console.error(
    '[SCRAPER] Price flow timeout.'
  );

  console.error(
    '[SCRAPER] Current price block:',
    cleanText(currentText)
  );

  throw new Error(
    `Price flow timed out after ${PRICE_WAIT_TIMEOUT}ms. ` +
    `Current block: ${cleanText(currentText)}`
  );
}

    /*
     * --------------------------------------------------
     * 10. Dynamic selectors
     * --------------------------------------------------
     */
await page.waitForTimeout(500);
    const classes =
      layout?.classes || {};

    function selector(key) {
      const className =
        classes[key];

      if (!className) {
        return null;
      }

      return `.${className}`;
    }

    async function getText(key) {
      const css =
        selector(key);

      if (!css) {
        return null;
      }

      const locator =
        page.locator(css).first();

      if (
        await locator.count() === 0
      ) {
        return null;
      }

      try {
        return cleanText(
          await locator.innerText()
        );
      } catch {
        return null;
      }
    }

    /*
     * --------------------------------------------------
     * 11. Extract values
     * --------------------------------------------------
     */

    const priceText =
      await getText('priceValue');

    const mrpText =
      await getText('mrp');

    const saleText =
      await getText('sale');

    const stockText =
      await getText('stock');

    const sellerText =
      await getText('seller');

    const fullPriceBlock =
      cleanText(
        await priceBlock.innerText()
      );

    console.log(
      '[SCRAPER] Price block:',
      fullPriceBlock
    );

    /*
     * --------------------------------------------------
     * 12. Parse price / MRP / stock
     * --------------------------------------------------
     */

    let price =
      cleanMoney(priceText);

    let mrp =
      cleanMoney(mrpText);

    let stock =
      cleanStock(stockText);

    /*
     * Fallback price extraction.
     */

    if (price === null) {
      const moneyMatches =
        fullPriceBlock.match(
          /₹[\u200B-\u200D\uFEFF\s]*[\d,\u200B-\u200D\uFEFF]+/g
        ) || [];

      if (
        moneyMatches.length > 0
      ) {
        price =
          cleanMoney(
            moneyMatches[
              moneyMatches.length - 1
            ]
          );
      }
    }

    /*
     * Fallback MRP extraction.
     */

    if (mrp === null) {
      const moneyMatches =
        fullPriceBlock.match(
          /₹[\u200B-\u200D\uFEFF\s]*[\d,\u200B-\u200D\uFEFF]+/g
        ) || [];

      if (
        moneyMatches.length > 0
      ) {
        mrp =
          cleanMoney(
            moneyMatches[0]
          );
      }
    }

    /*
     * Fallback stock extraction.
     */

    if (stock === null) {
      stock =
        cleanStock(
          fullPriceBlock
        );
    }

    /*
     * --------------------------------------------------
     * 13. Discount
     * --------------------------------------------------
     */

    const discount =
      cleanDiscount(
        fullPriceBlock
      );

    /*
     * --------------------------------------------------
     * 14. Stock status
     * --------------------------------------------------
     */

    let stockStatus =
      'unknown';

    if (
      /out of stock/i.test(
        fullPriceBlock
      )
    ) {
      stockStatus =
        'out_of_stock';

    } else if (
      stock !== null
    ) {
      stockStatus =
        'in_stock';
    }

    /*
     * --------------------------------------------------
     * 15. Validate price
     * --------------------------------------------------
     */

    if (price === null) {
      throw new Error(
        `Price could not be extracted. ` +
        `Price text: ${priceText}. ` +
        `Price block: ${fullPriceBlock}`
      );
    }

    /*
     * --------------------------------------------------
     * 16. Final result
     * --------------------------------------------------
     */

    const durationMs =
      Date.now() - startedAt;

    const result = {
      productId:
        product.id,

      name:
        cleanText(
          product.name
        ),

      brand:
        cleanText(
          product.brand
        ),

      category:
        cleanText(
          product.category
        ),

      sku:
        cleanText(
          product.sku
        ),

      price,

      mrp,

      discount,

      stock,

      stockStatus,

      seller:
        cleanText(
          sellerText
        ),

      currency:
        'INR',

      scrapedAt:
        new Date().toISOString(),

      durationMs,

      raw: {
        priceText,
        mrpText,
        saleText,
        stockText,
        sellerText,
        priceBlock:
          fullPriceBlock
      }
    };

    console.log(
      '[SCRAPER] Successful:',
      {
        productId:
          result.productId,

        price:
          result.price,

        mrp:
          result.mrp,

        discount:
          result.discount,

        stock:
          result.stock,

        stockStatus:
          result.stockStatus,

        durationMs:
          result.durationMs
      }
    );

    return result;

  } catch (error) {
    console.error(
      '[SCRAPER] Failed:',
      error.message
    );

    throw error;

  } finally {
    if (browser) {
      await browser.close();
    }
  }
}