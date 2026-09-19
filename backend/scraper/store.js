const BASE =
  process.env.STORE_BASE_URL ||
  "https://demo.inelabteamdev.com";

const timeoutMs = Number(
  process.env.SCRAPE_TIMEOUT_MS || 12000
);

const PAGE_SIZE = 100;
const MAX_RESULTS = 20;

// Cache successfully fetched catalog pages.
const catalogCache = new Map();

let totalPages = null;

let lastCatalogRequest = 0;


// =====================================================
// SLEEP
// =====================================================

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}


// =====================================================
// WAIT BETWEEN REQUESTS
// =====================================================

async function waitForRateLimit() {

  const now = Date.now();

  const elapsed =
    now - lastCatalogRequest;

  const minimumDelay = 1200;

  if (elapsed < minimumDelay) {

    await sleep(
      minimumDelay - elapsed
    );
  }

  lastCatalogRequest =
    Date.now();
}


// =====================================================
// FETCH JSON
// =====================================================

async function fetchJson(url) {

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      timeoutMs
    );


  try {

    const response =
      await fetch(url, {

        signal:
          controller.signal,

        headers: {

          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36",

          Accept:
            "application/json, text/plain, */*",

          "Accept-Language":
            "en-US,en;q=0.9",

          Referer:
            `${BASE}/`,
        },

      });


    if (
      response.status === 429 ||
      response.status === 503
    ) {

      throw new Error(
        `RATE_LIMIT:${response.status}`
      );
    }


    if (!response.ok) {

      throw new Error(
        `Store returned HTTP ${response.status}`
      );
    }


    return await response.json();

  } finally {

    clearTimeout(timer);
  }
}


// =====================================================
// FETCH CATALOG PAGE
// =====================================================

async function fetchCatalogPage(page) {

  // Return cached page
  if (
    catalogCache.has(page)
  ) {

    console.log(
      `[CATALOG] Using cached page ${page}`
    );

    return catalogCache.get(page);
  }


  await waitForRateLimit();


  const url =
    `${BASE}/api/catalog?page=${page}&pageSize=${PAGE_SIZE}`;


  console.log(
    `[CATALOG] Fetching page ${page}/${totalPages || "?"}`
  );


  let lastError = null;


  for (
    let attempt = 1;
    attempt <= 3;
    attempt++
  ) {

    try {

      const data =
        await fetchJson(url);


      const result = {

        items:
          Array.isArray(data.items)
            ? data.items
            : [],

        pages:
          Number(data.pages || 1),

        total:
          Number(data.total || 0),

      };


      totalPages =
        result.pages;


      catalogCache.set(
        page,
        result
      );


      console.log(
        `[CATALOG] Page ${page} cached (${result.items.length} products)`
      );


      return result;


    } catch (error) {

      lastError =
        error;


      console.log(
        `[CATALOG] Page ${page} attempt ${attempt}/3 failed: ${error.message}`
      );


      if (
        !error.message.startsWith(
          "RATE_LIMIT:"
        )
      ) {

        throw error;
      }


      if (
        attempt < 3
      ) {

        const waitTime =
          attempt === 1
            ? 3000
            : 7000;


        console.log(
          `[CATALOG] Waiting ${waitTime}ms...`
        );


        await sleep(
          waitTime
        );
      }
    }
  }


  throw lastError;
}


// =====================================================
// MATCH PRODUCT
// =====================================================

function matchesProduct(
  product,
  query
) {

  const searchableText = [

    product.name,

    product.brand,

    product.category,

    product.sku,

    product.description,

    product.slug,

  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();


  return searchableText.includes(
    query
  );
}


// =====================================================
// FORMAT PRODUCT
// =====================================================

function formatProduct(
  product
) {

  return {

    product_id:
      product.id,

    name:
      product.name,

    brand:
      product.brand || null,

    category:
      product.category || null,

    sku:
      product.sku || null,

    description:
      product.description || null,

    url:
      `${BASE}/product/${product.id}`,

  };
}


// =====================================================
// SEARCH STORE PRODUCTS
// =====================================================

export async function searchStoreProducts(
  query
) {

  const normalizedQuery =
    query.trim().toLowerCase();


  if (!normalizedQuery) {
    return [];
  }


  console.log(
    `[SEARCH] Searching for "${normalizedQuery}"`
  );


  const results = [];


  // ---------------------------------------------------
  // Search already cached pages first
  // ---------------------------------------------------

  for (
    const pageData
    of catalogCache.values()
  ) {

    for (
      const product
      of pageData.items
    ) {

      if (
        matchesProduct(
          product,
          normalizedQuery
        )
      ) {

        results.push(
          formatProduct(product)
        );


        if (
          results.length >=
          MAX_RESULTS
        ) {

          return results;
        }
      }
    }
  }


  // ---------------------------------------------------
  // Load page 1 if necessary
  // ---------------------------------------------------

  const firstPage =
    await fetchCatalogPage(1);


  // ---------------------------------------------------
  // Search page 1
  // ---------------------------------------------------

  for (
    const product
    of firstPage.items
  ) {

    if (
      !matchesProduct(
        product,
        normalizedQuery
      )
    ) {

      continue;
    }


    const exists =
      results.some(
        (item) =>
          item.product_id ===
          product.id
      );


    if (!exists) {

      results.push(
        formatProduct(product)
      );
    }


    if (
      results.length >=
      MAX_RESULTS
    ) {

      return results;
    }
  }


  // ---------------------------------------------------
  // Search remaining pages
  // ---------------------------------------------------

  for (
    let page = 2;
    page <= totalPages;
    page++
  ) {

    const pageData =
      await fetchCatalogPage(page);


    for (
      const product
      of pageData.items
    ) {

      if (
        !matchesProduct(
          product,
          normalizedQuery
        )
      ) {

        continue;
      }


      const exists =
        results.some(
          (item) =>
            item.product_id ===
            product.id
        );


      if (!exists) {

        results.push(
          formatProduct(product)
        );
      }


      if (
        results.length >=
        MAX_RESULTS
      ) {

        return results;
      }
    }
  }


  console.log(
    `[SEARCH] Found ${results.length} result(s)`
  );


  return results;
}


// =====================================================
// DIRECT PRODUCT LOOKUP
// =====================================================

export async function getStoreProduct(
  productId
) {

  const url =
    `${BASE}/api/product/${productId}`;


  return await fetchJson(url);
}


// =====================================================
// CATALOG STATUS
// =====================================================

export function getCatalogStatus() {

  return {

    cachedPages:
      catalogCache.size,

    totalPages,

    cachedProducts:
      [...catalogCache.values()]
        .reduce(
          (total, page) =>
            total + page.items.length,
          0
        ),

  };
}