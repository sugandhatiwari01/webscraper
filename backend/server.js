import 'dotenv/config';

import express from 'express';
import cors from 'cors';

import { createClient } from '@supabase/supabase-js';

import { searchStoreProducts } from './scraper/store.js';
import { scrapeProduct } from './scraper/scrape.js';

const app = express();

const PORT = process.env.PORT || 5000;

const STORE_BASE_URL =
  process.env.STORE_BASE_URL ||
  'https://demo.inelabteamdev.com';

// =====================================================
// SUPABASE
// =====================================================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(
  cors({
    origin:
      process.env.FRONTEND_URL ||
      'http://localhost:5173'
  })
);

app.use(express.json());

// =====================================================
// HEALTH CHECK
// =====================================================

app.get('/api/health', async (req, res) => {
  res.json({
    ok: true,
    service: 'INE Price Tracker API',
    time: new Date().toISOString()
  });
});

// =====================================================
// GET PRODUCT FROM INE STORE
// =====================================================

async function getStoreProduct(productId) {
  const response = await fetch(
    `${STORE_BASE_URL}/api/product/${productId}`
  );

  if (!response.ok) {
    throw new Error(
      `INE product API returned HTTP ${response.status}`
    );
  }

  return response.json();
}

// =====================================================
// TRACK PRODUCT
// =====================================================

app.post('/api/products/track', async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        error: 'productId is required'
      });
    }

    const product = await getStoreProduct(productId);

    const productUrl =
      `${STORE_BASE_URL}/product/${productId}`;

    const { data, error } = await supabase
      .from('tracked_products')
      .upsert(
        {
          product_id: product.id,
          name: product.name,
          brand: product.brand,
          category: product.category,
          sku: product.sku,
          product_url: productUrl,
          is_active: true
        },
        {
          onConflict: 'product_id'
        }
      )
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      product: data
    });

  } catch (error) {
    console.error('[TRACK ERROR]', error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================================================
// GET TRACKED PRODUCTS
// =====================================================

app.get('/api/products/tracked', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tracked_products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', {
        ascending: false
      });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      products: data
    });

  } catch (error) {
    console.error(
      '[TRACKED PRODUCTS ERROR]',
      error
    );

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================================================
// SCRAPE ONE PRODUCT + SAVE RESULT
// =====================================================

async function scrapeAndStoreProduct(productId) {
  const startedAt = Date.now();

  console.log(
    `[SCRAPE] Starting scrape for product ${productId}`
  );

  // -----------------------------------------------
  // Make sure product is tracked
  // -----------------------------------------------

  let {
    data: trackedProduct,
    error: trackedError
  } = await supabase
    .from('tracked_products')
    .select('*')
    .eq('product_id', productId)
    .maybeSingle();

  if (trackedError) {
    throw trackedError;
  }

  // -----------------------------------------------
  // If not tracked, create it
  // -----------------------------------------------

  if (!trackedProduct) {
    const product =
      await getStoreProduct(productId);

    const { data, error } = await supabase
      .from('tracked_products')
      .insert({
        product_id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        sku: product.sku,
        product_url:
          `${STORE_BASE_URL}/product/${productId}`,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    trackedProduct = data;
  }

  // -----------------------------------------------
  // Run scraper
  // -----------------------------------------------

  const result =
    await scrapeProduct(productId);

  const durationMs =
    result.durationMs ||
    Date.now() - startedAt;

  // -----------------------------------------------
  // Save price history
  // -----------------------------------------------

  const {
    data: history,
    error: historyError
  } = await supabase
    .from('price_history')
    .insert({
      tracked_product_id:
        trackedProduct.id,

      product_id:
        result.productId,

      price:
        result.price,

      mrp:
        result.mrp,

      discount:
        result.discount,

      stock:
        result.stock,

      stock_status:
        result.stockStatus,

      seller:
        result.seller,

      currency:
        result.currency,

      scraped_at:
        result.scrapedAt,

      duration_ms:
        durationMs
    })
    .select()
    .single();

  if (historyError) {
    throw historyError;
  }

  // -----------------------------------------------
  // Save successful scrape log
  // -----------------------------------------------

  const {
    error: logError
  } = await supabase
    .from('scrape_logs')
    .insert({
      tracked_product_id:
        trackedProduct.id,

      product_id:
        result.productId,

      status:
        'success',

      attempt:
        1,

      duration_ms:
        durationMs,

      error_message:
        null,

      response_status:
        200,

      scraped_at:
        result.scrapedAt
    });

  if (logError) {
    throw logError;
  }

  console.log(
    `[SCRAPE] Success: ${result.name} - ₹${result.price}`
  );

  return {
    result,
    history,
    durationMs
  };
}

// =====================================================
// RUN SCRAPE FOR ONE PRODUCT
// =====================================================

app.post('/api/scrape/run', async (req, res) => {
  const startedAt = Date.now();

  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        error: 'productId is required'
      });
    }

    const {
      result,
      history,
      durationMs
    } = await scrapeAndStoreProduct(
      Number(productId)
    );

    return res.json({
      success: true,
      result,
      history,
      durationMs
    });

  } catch (error) {
    const durationMs =
      Date.now() - startedAt;

    console.error(
      '[SCRAPE ERROR]',
      error
    );

    // -----------------------------------------------
    // Try to log failed scrape
    // -----------------------------------------------

    try {
      const { productId } = req.body;

      let trackedProductId = null;

      if (productId) {
        const { data } = await supabase
          .from('tracked_products')
          .select('id')
          .eq('product_id', productId)
          .maybeSingle();

        trackedProductId =
          data?.id || null;
      }

      await supabase
        .from('scrape_logs')
        .insert({
          tracked_product_id:
            trackedProductId,

          product_id:
            productId || null,

          status:
            'failed',

          attempt:
            1,

          duration_ms:
            durationMs,

          error_message:
            error.message,

          response_status:
            null,

          scraped_at:
            new Date().toISOString()
        });

    } catch (logError) {
      console.error(
        '[FAILED SCRAPE LOG ERROR]',
        logError
      );
    }

    return res.status(500).json({
      success: false,
      error: error.message,
      durationMs
    });
  }
});

// =====================================================
// RUN SCRAPE FOR ALL ACTIVE TRACKED PRODUCTS
// =====================================================

app.post(
  '/api/scrape/run-all',
  async (req, res) => {
    const startedAt = Date.now();

    try {
      // ---------------------------------------------
      // Verify CRON secret
      // ---------------------------------------------

      const expectedSecret =
        process.env.CRON_SECRET;

      if (!expectedSecret) {
        console.error(
          '[CRON] CRON_SECRET is not configured'
        );

        return res.status(500).json({
          success: false,
          error:
            'CRON_SECRET is not configured'
        });
      }

      const authHeader =
        req.headers.authorization || '';

      let providedSecret = null;

      if (
        authHeader.startsWith(
          'Bearer '
        )
      ) {
        providedSecret =
          authHeader.slice(7);
      }

      // Also support x-cron-secret
      if (!providedSecret) {
        providedSecret =
          req.headers['x-cron-secret'];
      }

      if (
        providedSecret !==
        expectedSecret
      ) {
        console.warn(
          '[CRON] Unauthorized request'
        );

        return res.status(401).json({
          success: false,
          error: 'Unauthorized'
        });
      }

      // ---------------------------------------------
      // Get active tracked products
      // ---------------------------------------------

      const {
        data: products,
        error
      } = await supabase
        .from('tracked_products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', {
          ascending: true
        });

      if (error) {
        throw error;
      }

      console.log(
        `[CRON] Starting scrape for ${products.length} products`
      );

      // ---------------------------------------------
      // Scrape sequentially
      // ---------------------------------------------

      const results = [];

      for (const product of products) {
        const productStartedAt =
          Date.now();

        try {
          console.log(
            `[CRON] Scraping ${product.product_id} - ${product.name}`
          );

          const result =
            await scrapeAndStoreProduct(
              product.product_id
            );

          results.push({
            productId:
              product.product_id,

            name:
              product.name,

            status:
              'success',

            price:
              result.result.price,

            stock:
              result.result.stock,

            durationMs:
              result.durationMs
          });

        } catch (error) {
          const durationMs =
            Date.now() -
            productStartedAt;

          console.error(
            `[CRON] Failed product ${product.product_id}:`,
            error.message
          );

          // -----------------------------------------
          // Log failure
          // -----------------------------------------

          try {
            await supabase
              .from('scrape_logs')
              .insert({
                tracked_product_id:
                  product.id,

                product_id:
                  product.product_id,

                status:
                  'failed',

                attempt:
                  1,

                duration_ms:
                  durationMs,

                error_message:
                  error.message,

                response_status:
                  null,

                scraped_at:
                  new Date().toISOString()
              });

          } catch (logError) {
            console.error(
              '[CRON FAILED LOG ERROR]',
              logError
            );
          }

          // -----------------------------------------
          // Continue with next product
          // -----------------------------------------

          results.push({
            productId:
              product.product_id,

            name:
              product.name,

            status:
              'failed',

            error:
              error.message,

            durationMs
          });
        }
      }

      // ---------------------------------------------
      // Summary
      // ---------------------------------------------

      const successful =
        results.filter(
          item =>
            item.status ===
            'success'
        ).length;

      const failed =
        results.filter(
          item =>
            item.status ===
            'failed'
        ).length;

      const durationMs =
        Date.now() -
        startedAt;

      console.log(
        `[CRON] Finished. Success: ${successful}, Failed: ${failed}, Duration: ${durationMs}ms`
      );

      return res.json({
        success: true,

        summary: {
          total:
            results.length,

          successful,

          failed,

          durationMs
        },

        results
      });

    } catch (error) {
      console.error(
        '[CRON ERROR]',
        error
      );

      return res.status(500).json({
        success: false,

        error:
          error.message,

        durationMs:
          Date.now() -
          startedAt
      });
    }
  }
);

// =====================================================
// PRICE HISTORY
// =====================================================

app.get(
  '/api/products/:productId/history',
  async (req, res) => {
    try {
      const productId =
        Number(req.params.productId);

      const {
        data,
        error
      } = await supabase
        .from('price_history')
        .select('*')
        .eq(
          'product_id',
          productId
        )
        .order(
          'scraped_at',
          {
            ascending: true
          }
        );

      if (error) {
        throw error;
      }

      res.json({
        success: true,
        history: data
      });

    } catch (error) {
      console.error(
        '[HISTORY ERROR]',
        error
      );

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// =====================================================
// SCRAPE LOGS
// =====================================================

app.get(
  '/api/products/:productId/logs',
  async (req, res) => {
    try {
      const productId =
        Number(req.params.productId);

      const {
        data,
        error
      } = await supabase
        .from('scrape_logs')
        .select('*')
        .eq(
          'product_id',
          productId
        )
        .order(
          'scraped_at',
          {
            ascending: false
          }
        );

      if (error) {
        throw error;
      }

      res.json({
        success: true,
        logs: data
      });

    } catch (error) {
      console.error(
        '[LOGS ERROR]',
        error
      );

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// =====================================================
// SEARCH STORE PRODUCTS
// =====================================================

app.get(
  '/api/products/search',
  async (req, res) => {
    try {
      const query =
        String(
          req.query.q || ''
        ).trim();

      if (!query) {
        return res.status(400).json({
          error:
            'Search query is required'
        });
      }

      // ---------------------------------------------
      // Numeric product ID search
      // ---------------------------------------------

      if (/^\d+$/.test(query)) {
        const productId =
          Number(query);

        try {
          const product =
            await getStoreProduct(
              productId
            );

          return res.json([
            {
              product_id:
                product.id,

              name:
                product.name,

              brand:
                product.brand,

              category:
                product.category,

              sku:
                product.sku,

              description:
                product.description ||
                null,

              url:
                `${STORE_BASE_URL}/product/${product.id}`
            }
          ]);

        } catch {
          return res.json([]);
        }
      }

      // ---------------------------------------------
      // Normal catalog search
      // ---------------------------------------------

      const products =
        await searchStoreProducts(
          query
        );

      return res.json(
        products
      );

    } catch (error) {
      console.error(
        '[SEARCH ERROR]',
        error
      );

      return res.status(500).json({
        error:
          error.message ||
          'Search failed'
      });
    }
  }
);

// =====================================================
// START SERVER
// =====================================================

app.listen(
  PORT,
  () => {
    console.log(
      `Server running on http://localhost:${PORT}`
    );
  }
);