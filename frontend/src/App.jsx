import React, { useEffect, useState } from "react";

const API =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";


// =====================================================
// APP
// =====================================================

export default function App() {

  // ---------------------------------------------------
  // Search
  // ---------------------------------------------------

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");


  // ---------------------------------------------------
  // Tracked products
  // ---------------------------------------------------

  const [trackedProducts, setTrackedProducts] =
    useState([]);

  const [loadingTracked, setLoadingTracked] =
    useState(true);


  // ---------------------------------------------------
  // Selected product
  // ---------------------------------------------------

  const [selectedProduct, setSelectedProduct] =
    useState(null);

  const [history, setHistory] =
    useState([]);

  const [logs, setLogs] =
    useState([]);


  // ---------------------------------------------------
  // UI state
  // ---------------------------------------------------

  const [loadingDetails, setLoadingDetails] =
    useState(false);

  const [tracking, setTracking] =
    useState(false);

  const [scraping, setScraping] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");


  // ===================================================
  // LOAD TRACKED PRODUCTS
  // ===================================================

  async function loadTrackedProducts() {

    setLoadingTracked(true);

    try {

      const response =
        await fetch(
          `${API}/api/products/tracked`
        );


      if (!response.ok) {
        throw new Error(
          "Failed to load tracked products"
        );
      }


      const data =
        await response.json();


      setTrackedProducts(
        Array.isArray(data)
          ? data
          : data.products || []
      );

    } catch (err) {

      setError(err.message);

    } finally {

      setLoadingTracked(false);
    }
  }


  // ===================================================
  // INITIAL LOAD
  // ===================================================

  useEffect(() => {

    loadTrackedProducts();

  }, []);


  // ===================================================
  // SEARCH
  // ===================================================

  async function handleSearch(event) {

    event?.preventDefault();

    const query =
      search.trim();


    if (!query) {

      setSearchResults([]);
      return;
    }


    setSearching(true);
    setSearchError("");
    setMessage("");


    try {

      const response =
        await fetch(
          `${API}/api/products/search?q=${encodeURIComponent(query)}`
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.error ||
          "Search failed"
        );
      }


      setSearchResults(
        Array.isArray(data)
          ? data
          : data.products || []
      );


    } catch (err) {

      setSearchError(
        err.message
      );

    } finally {

      setSearching(false);
    }
  }


  // ===================================================
  // TRACK PRODUCT
  // ===================================================

  async function trackProduct(product) {

    setTracking(true);
    setError("");
    setMessage("");


    try {

      const response =
        await fetch(
          `${API}/api/products/track`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              productId:
                product.product_id ||
                product.id,

              name:
                product.name,

              brand:
                product.brand,

              category:
                product.category,

              sku:
                product.sku,

              productUrl:
                product.url ||
                `${window.location.origin}/product/${product.product_id}`,
            }),
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.error ||
          "Failed to track product"
        );
      }


      setMessage(
        "Product added to tracking."
      );


      await loadTrackedProducts();


    } catch (err) {

      setError(
        err.message
      );

    } finally {

      setTracking(false);
    }
  }


  // ===================================================
  // LOAD PRODUCT DETAILS
  // ===================================================

  async function selectProduct(product) {

    setSelectedProduct(product);

    setHistory([]);
    setLogs([]);
    setLoadingDetails(true);
    setError("");
    setMessage("");


    const productId =
      product.product_id ||
      product.id;


    try {

      const [
        historyResponse,
        logsResponse,
      ] = await Promise.all([

        fetch(
          `${API}/api/products/${productId}/history`
        ),

        fetch(
          `${API}/api/products/${productId}/logs`
        ),

      ]);


      const historyData =
        await historyResponse.json();

      const logsData =
        await logsResponse.json();


      if (!historyResponse.ok) {

        throw new Error(
          historyData.error ||
          "Failed to load history"
        );
      }


      if (!logsResponse.ok) {

        throw new Error(
          logsData.error ||
          "Failed to load logs"
        );
      }


      setHistory(
        Array.isArray(historyData)
          ? historyData
          : historyData.history || []
      );


      setLogs(
        Array.isArray(logsData)
          ? logsData
          : logsData.logs || []
      );


    } catch (err) {

      setError(
        err.message
      );

    } finally {

      setLoadingDetails(false);
    }
  }


  // ===================================================
  // SCRAPE NOW
  // ===================================================

  async function scrapeNow() {

    if (!selectedProduct) {
      return;
    }


    const productId =
      selectedProduct.product_id ||
      selectedProduct.id;


    setScraping(true);
    setError("");
    setMessage("");


    try {

      const response =
        await fetch(
          `${API}/api/scrape/run`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              productId,
            }),
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.error ||
          "Scrape failed"
        );
      }


      setMessage(
        "Scrape completed successfully."
      );


      // Refresh product details
      await selectProduct(
        selectedProduct
      );


    } catch (err) {

      setError(
        err.message
      );

    } finally {

      setScraping(false);
    }
  }


  // ===================================================
  // HELPERS
  // ===================================================

  function formatPrice(value) {

    if (
      value === null ||
      value === undefined
    ) {
      return "—";
    }


    return `₹${Number(value).toLocaleString(
      "en-IN"
    )}`;
  }


  function formatDate(value) {

    if (!value) {
      return "—";
    }


    return new Date(value).toLocaleString(
      "en-IN",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    );
  }


  function getLatestHistory() {

    if (!history.length) {
      return null;
    }


    return history[0];
  }


  const latest =
    getLatestHistory();


  // ===================================================
  // RENDER
  // ===================================================

  return (

    <div className="app">

      {/* =================================================
          HEADER
      ================================================= */}

      <header className="topbar">

        <div>

          <h1>
            INE Price Tracker
          </h1>

          <p>
            Track product prices,
            stock and scrape history.
          </p>

        </div>

      </header>


      <main className="container">


        {/* =================================================
            GLOBAL MESSAGE
        ================================================= */}

        {message && (

          <div className="success-message">
            {message}
          </div>

        )}


        {error && (

          <div className="error-message">
            {error}
          </div>

        )}


        {/* =================================================
            SEARCH
        ================================================= */}

        <section className="card">

          <div className="section-header">

            <div>

              <h2>
                Search Store
              </h2>

              <p>
                Find a product to track.
              </p>

            </div>

          </div>


          <form
            className="search-form"
            onSubmit={handleSearch}
          >

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search products..."
            />

            <button
              type="submit"
              disabled={
                searching ||
                !search.trim()
              }
            >

              {searching
                ? "Searching..."
                : "Search"}

            </button>

          </form>


          {searchError && (

            <p className="error-text">
              {searchError}
            </p>

          )}


          {/* SEARCH RESULTS */}

          {searchResults.length > 0 && (

            <div className="search-results">

              <h3>
                Search Results
              </h3>


              {searchResults.map(
                (product) => (

                  <div
                    className="product-result"
                    key={
                      product.product_id ||
                      product.id
                    }
                  >

                    <div>

                      <strong>
                        {product.name}
                      </strong>

                      <span>
                        {product.brand}
                        {" • "}
                        {product.category}
                      </span>

                      <small>
                        SKU:{" "}
                        {product.sku ||
                          "N/A"}
                      </small>

                    </div>


                    <div className="result-actions">

                      <button
                        className="secondary-button"
                        onClick={() =>
                          selectProduct(
                            product
                          )
                        }
                      >
                        View
                      </button>


                      <button
                        className="primary-button"
                        onClick={() =>
                          trackProduct(
                            product
                          )
                        }
                        disabled={tracking}
                      >
                        {tracking
                          ? "Tracking..."
                          : "Track"}
                      </button>

                    </div>

                  </div>

                )
              )}

            </div>

          )}


          {!searching &&
            search.trim() &&
            searchResults.length === 0 &&
            !searchError && (

              <p className="empty-text">
                No products found.
              </p>

            )}

        </section>


        {/* =================================================
            TRACKED PRODUCTS
        ================================================= */}

        <section className="card">

          <div className="section-header">

            <div>

              <h2>
                Tracked Products
              </h2>

              <p>
                Products currently being monitored.
              </p>

            </div>

          </div>


          {loadingTracked ? (

            <p className="empty-text">
              Loading products...
            </p>

          ) : trackedProducts.length === 0 ? (

            <p className="empty-text">
              No products tracked yet.
            </p>

          ) : (

            <div className="tracked-grid">

              {trackedProducts.map(
                (product) => (

                  <button
                    className={
                      "tracked-product " +
                      (
                        selectedProduct?.product_id ===
                        product.product_id
                          ? "selected"
                          : ""
                      )
                    }
                    key={product.id}
                    onClick={() =>
                      selectProduct(
                        product
                      )
                    }
                  >

                    <strong>
                      {product.name}
                    </strong>

                    <span>
                      {product.brand ||
                        "Unknown brand"}
                    </span>

                    <small>
                      ID:{" "}
                      {product.product_id}
                    </small>

                  </button>

                )
              )}

            </div>

          )}

        </section>


        {/* =================================================
            PRODUCT DETAILS
        ================================================= */}

        {selectedProduct && (

          <section className="card">

            <div className="product-heading">

              <div>

                <span className="eyebrow">
                  TRACKED PRODUCT
                </span>

                <h2>
                  {selectedProduct.name}
                </h2>

                <p>
                  {selectedProduct.brand}
                  {" • "}
                  {selectedProduct.category}
                </p>

              </div>


              <button
                className="primary-button"
                onClick={scrapeNow}
                disabled={
                  scraping ||
                  loadingDetails
                }
              >

                {scraping
                  ? "Scraping..."
                  : "Scrape Now"}

              </button>

            </div>


            {loadingDetails ? (

              <p className="empty-text">
                Loading product data...
              </p>

            ) : (

              <>

                {/* =========================================
                    CURRENT DATA
                ========================================= */}

                <div className="stats-grid">

                  <div className="stat-card">

                    <span>
                      Current Price
                    </span>

                    <strong>
                      {formatPrice(
                        latest?.price
                      )}
                    </strong>

                  </div>


                  <div className="stat-card">

                    <span>
                      MRP
                    </span>

                    <strong>
                      {formatPrice(
                        latest?.mrp
                      )}
                    </strong>

                  </div>


                  <div className="stat-card">

                    <span>
                      Discount
                    </span>

                    <strong>
                      {latest?.discount != null
                        ? `${latest.discount}%`
                        : "—"}
                    </strong>

                  </div>


                  <div className="stat-card">

                    <span>
                      Stock
                    </span>

                    <strong>
                      {latest?.stock ??
                        "—"}
                    </strong>

                  </div>


                  <div className="stat-card">

                    <span>
                      Status
                    </span>

                    <strong>
                      {latest?.stock_status ||
                        "—"}
                    </strong>

                  </div>


                  <div className="stat-card">

                    <span>
                      Seller
                    </span>

                    <strong>
                      {latest?.seller ||
                        "—"}
                    </strong>

                  </div>

                </div>


                {/* =========================================
                    PRICE HISTORY
                ========================================= */}

                <div className="data-section">

                  <div className="section-header">

                    <div>

                      <h3>
                        Price History
                      </h3>

                      <p>
                        Historical price and stock observations.
                      </p>

                    </div>

                  </div>


                  {history.length === 0 ? (

                    <p className="empty-text">
                      No scrape history yet.
                      Click "Scrape Now" to create
                      the first observation.
                    </p>

                  ) : (

                    <div className="table-wrapper">

                      <table>

                        <thead>

                          <tr>

                            <th>
                              Time
                            </th>

                            <th>
                              Price
                            </th>

                            <th>
                              MRP
                            </th>

                            <th>
                              Discount
                            </th>

                            <th>
                              Stock
                            </th>

                            <th>
                              Seller
                            </th>

                          </tr>

                        </thead>


                        <tbody>

                          {history.map(
                            (row) => (

                              <tr
                                key={row.id}
                              >

                                <td>
                                  {formatDate(
                                    row.scraped_at
                                  )}
                                </td>

                                <td>
                                  {formatPrice(
                                    row.price
                                  )}
                                </td>

                                <td>
                                  {formatPrice(
                                    row.mrp
                                  )}
                                </td>

                                <td>
                                  {row.discount != null
                                    ? `${row.discount}%`
                                    : "—"}
                                </td>

                                <td>
                                  {row.stock ??
                                    "—"}
                                </td>

                                <td>
                                  {row.seller ||
                                    "—"}
                                </td>

                              </tr>

                            )
                          )}

                        </tbody>

                      </table>

                    </div>

                  )}

                </div>


                {/* =========================================
                    SCRAPE LOGS
                ========================================= */}

                <div className="data-section">

                  <div className="section-header">

                    <div>

                      <h3>
                        Scrape Logs
                      </h3>

                      <p>
                        Execution history and failures.
                      </p>

                    </div>

                  </div>


                  {logs.length === 0 ? (

                    <p className="empty-text">
                      No scrape logs yet.
                    </p>

                  ) : (

                    <div className="table-wrapper">

                      <table>

                        <thead>

                          <tr>

                            <th>
                              Time
                            </th>

                            <th>
                              Status
                            </th>

                            <th>
                              Attempt
                            </th>

                            <th>
                              Duration
                            </th>

                            <th>
                              Error
                            </th>

                          </tr>

                        </thead>


                        <tbody>

                          {logs.map(
                            (log) => (

                              <tr
                                key={log.id}
                              >

                                <td>
                                  {formatDate(
                                    log.scraped_at
                                  )}
                                </td>

                                <td>

                                  <span
                                    className={
                                      log.status ===
                                      "success"
                                        ? "status-success"
                                        : "status-failed"
                                    }
                                  >
                                    {log.status}
                                  </span>

                                </td>

                                <td>
                                  {log.attempt ??
                                    "—"}
                                </td>

                                <td>
                                  {log.duration_ms != null
                                    ? `${log.duration_ms} ms`
                                    : "—"}
                                </td>

                                <td>
                                  {log.error_message ||
                                    "—"}
                                </td>

                              </tr>

                            )
                          )}

                        </tbody>

                      </table>

                    </div>

                  )}

                </div>

              </>

            )}

          </section>

        )}

      </main>

    </div>
  );
}