# INE Price Tracker

A full-stack price and stock tracking application for the INE mock storefront.

Users can search products from the INE storefront, track products, manually trigger scrapes, and view historical price/stock data and per-product scrape logs.

## Live Demo

- Frontend: https://webscraper-dusky.vercel.app
- Backend API: https://webscraper-1-2xb3.onrender.com
- Store: https://demo.inelabteamdev.com

## Features

- Search products from the INE storefront
- Search by product name/keyword or product ID
- Track products for monitoring
- Store product metadata in PostgreSQL
- Scrape:
  - Current price
  - MRP
  - Discount
  - Stock quantity
  - Stock status
  - Seller
  - Scrape duration
  - Timestamp
- Maintain price/stock history
- Maintain per-product scrape logs
- Record successful and failed scrape attempts
- Manual single-product scraping
- Scheduled scraping through an external cron service
- Responsive React dashboard
- REST API using Node.js and Express

---

## Architecture

```text
                    ┌──────────────────────┐
                    │      INE Store       │
                    │ demo.inelabteamdev   │
                    │        .com          │
                    └──────────┬───────────┘
                               │
                         HTTP / Playwright
                               │
                               ▼
┌─────────────────┐     ┌──────────────────────┐
│ React Frontend  │────▶│ Node.js / Express    │
│     Vercel      │     │       Render         │
└─────────────────┘     └──────────┬───────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
              Store Search     Playwright      REST APIs
              + Catalog        Scraper
                                   │
                                   ▼
                         ┌─────────────────┐
                         │ Supabase        │
                         │ PostgreSQL      │
                         └─────────────────┘
                                   ▲
                                   │
                         ┌─────────┴─────────┐
                         │  cron-job.org     │
                         │ External Scheduler│
                         └───────────────────┘

                         Tech Stack
Frontend
React
Vite
JavaScript
CSS
Vercel
Backend
Node.js
Express.js
Playwright
Cheerio
CORS
dotenv
Database
Supabase
PostgreSQL
Scheduling
cron-job.org
Deployment
Frontend: Vercel
Backend: Render
Database: Supabase
Database Schema
tracked_products

Stores products selected for tracking.

Column	Type	Description
id	UUID	Primary key
product_id	INTEGER	INE product ID
name	TEXT	Product name
brand	TEXT	Product brand
category	TEXT	Product category
sku	TEXT	Product SKU
product_url	TEXT	Store product URL
is_active	BOOLEAN	Whether the product is actively tracked
created_at	TIMESTAMPTZ	Creation timestamp
updated_at	TIMESTAMPTZ	Last update timestamp

product_id is unique.

price_history

Stores every successful scrape result.

Column	Type	Description
id	BIGSERIAL	Primary key
tracked_product_id	UUID	Reference to tracked product
product_id	INTEGER	INE product ID
price	NUMERIC	Current price
mrp	NUMERIC	MRP
discount	NUMERIC	Displayed discount percentage
stock	INTEGER	Available stock
stock_status	TEXT	Stock state
seller	TEXT	Seller name
currency	TEXT	Currency
scraped_at	TIMESTAMPTZ	Scrape timestamp
duration_ms	INTEGER	Scrape duration
scrape_logs

Stores both successful and failed scrape attempts.

Column	Type	Description
id	BIGSERIAL	Primary key
tracked_product_id	UUID	Reference to tracked product
product_id	INTEGER	INE product ID
status	TEXT	success or failed
attempt	INTEGER	Attempt number
duration_ms	INTEGER	Duration
error_message	TEXT	Error information
response_status	INTEGER	HTTP response status
scraped_at	TIMESTAMPTZ	Attempt timestamp
Scraping Strategy

The scraper uses a hybrid approach.

1. HTTP/HTML where possible

Store catalog and product metadata are retrieved using normal HTTP requests.

Cheerio is used where server-rendered HTML is sufficient.

This keeps ordinary requests lightweight and avoids using a browser unnecessarily.

2. Playwright for protected price interaction

The current price on the INE mock storefront is not immediately available in the initial HTML.

The storefront requires an interaction with the price area before the "Reveal price" button becomes enabled.

Therefore Playwright is used only for the product-price interaction.

The scraper:

Opens the product page.
Handles the page state/cookie overlay where necessary.
Locates the price block.
Performs realistic mouse movement.
Waits for the reveal button to become enabled.
Clicks the reveal button.
Extracts price, MRP, discount, stock and seller.
Stores the result.
Search

The backend searches the INE catalog through the storefront catalog API.

For numeric queries, the backend treats the query as a product ID and directly requests the corresponding product.

For normal text queries, it searches catalog pages and filters matching products.

Catalog responses are cached to reduce unnecessary requests and avoid repeatedly requesting the same pages.

Reliability and Failure Handling

Scraping external pages is inherently unreliable, so the application records failures instead of silently losing them.

Individual scrape failure

If a product cannot be scraped, the error is recorded in scrape_logs.

For scheduled scraping, one failed product does not stop the loop from attempting the remaining tracked products.

Retries

The catalog search logic retries transient HTTP failures such as:

429 Too Many Requests
503 Service Unavailable

with increasing delays.

Browser interaction retries

The Playwright scraper retries the price interaction when the reveal button does not become enabled.

If the button remains disabled after the configured attempts, the scrape is marked as failed.

Logging

The backend records:

Product ID
Status
Attempt number
Duration
Error message
Timestamp
HTTP response status where applicable

This makes failed scrapes observable instead of hiding them.

API Endpoints
Health Check
GET /api/health

Example:

{
  "ok": true,
  "service": "INE Price Tracker API",
  "time": "..."
}
Search Products
GET /api/products/search?q=docking
Get Tracked Products
GET /api/products/tracked
Track Product
POST /api/products/track
Content-Type: application/json

{
  "productId": 120
}
Scrape One Product
POST /api/scrape/run
Content-Type: application/json

{
  "productId": 120
}
Price History
GET /api/products/:productId/history
Scrape Logs
GET /api/products/:productId/logs
Scheduled Scrape
POST /api/scrape/run-all
Authorization: Bearer <CRON_SECRET>

The scheduled endpoint retrieves all active tracked products and processes them sequentially.

Environment Variables
Backend

Create a .env file:

PORT=10000

STORE_BASE_URL=https://demo.inelabteamdev.com

SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

FRONTEND_URL=https://webscraper-dusky.vercel.app

CRON_SECRET=your_cron_secret
Frontend
VITE_API_URL=https://webscraper-1-2xb3.onrender.com

Do not include /api in VITE_API_URL.

Local Development
Backend
cd backend
npm install
npm start

For development:

npm run dev

The backend runs on:

http://localhost:10000
Frontend
cd frontend
npm install
npm run dev

The Vite development server will provide the local frontend URL.

Deployment
Backend

The backend is deployed on Render using the Playwright Docker image.

The Docker image provides the browser dependencies required by Playwright.

Example Dockerfile:

FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 10000

CMD ["npm", "start"]
Frontend

The React/Vite application is deployed on Vercel.

The production API URL is configured through:

VITE_API_URL=https://webscraper-1-2xb3.onrender.com
Scheduled Scraping

The application exposes:

POST /api/scrape/run-all

The endpoint is protected using CRON_SECRET.

An external scheduler such as cron-job.org can call it every two hours.

Example schedule:

0 */2 * * *

Request:

POST https://webscraper-1-2xb3.onrender.com/api/scrape/run-all
Authorization: Bearer <CRON_SECRET>
Scheduler trade-off

The scheduled endpoint performs browser-based scraping sequentially, so a run can take several minutes depending on the number of tracked products and the storefront response time.

This is a deliberate simple architecture for the assignment.

For a production system, this work would be better handled by a persistent background job system/queue rather than keeping a single HTTP request open for the entire scrape batch.

Observability

The application provides two levels of observability.

Application logs

Render logs show:

[SCRAPE] Starting scrape for product ...
[SCRAPER] Opening ...
[SCRAPER] Price interaction attempt ...
[SCRAPER] Successful ...
[SCRAPE] Success ...

Failures include the reason for failure.

Database logs

The scrape_logs table provides persistent per-product execution history.

This allows the dashboard to show whether a scrape succeeded or failed and how long it took.

Known Limitations
The INE storefront uses an interaction-based price reveal mechanism, so browser automation is required for current price extraction.
The storefront's anti-bot/interaction behavior can occasionally prevent the price from being revealed.
Playwright scraping is significantly slower than normal HTTP requests.
Sequential scheduled scraping can result in a long-running request when many products are tracked.
Render free-tier behavior can introduce cold-start latency.
The external scheduler depends on cron-job.org successfully invoking the backend.
Price history only records successful extraction results; failed attempts are stored separately in scrape_logs.
Design Decisions
Why PostgreSQL?

The data has clear relationships between tracked products, historical price records and scrape logs.

PostgreSQL provides:

Relational integrity
Foreign keys
Structured querying
Indexing
Timestamp-based history queries
Why Playwright?

A normal HTTP request is sufficient for catalog and product metadata, but the current price is revealed only after browser interaction.

Using Playwright only for that portion keeps the scraping architecture lighter than using browser automation for every request.

Why sequential scraping?

Sequential scraping reduces concurrent load on the storefront and makes individual failures easier to isolate and observe.

A production implementation could use controlled concurrency with a queue and rate limiter.

AI-Assisted Development

AI assistance was used during development for debugging, implementation ideas and code iteration.

Several assumptions were verified against the actual storefront rather than being accepted blindly.

For example:

The price was initially assumed to be available directly in the HTML.
Investigation showed that the price required an interaction-based reveal.
The scraper was therefore changed to use Playwright for the protected interaction.
Catalog pagination and rate limiting were also tested against the actual storefront behavior.
Scrape failures were retained as observable failures rather than treating every request as guaranteed to succeed.

The final implementation was tested against the deployed application and the target storefront.

Future Improvements

For a production version, the following could be added:

Background job queue such as BullMQ
Redis-backed job processing
Controlled parallel scraping
Persistent scheduler/worker architecture
Better anti-bot/session handling
Automatic alerting on price changes
Price-drop notifications
More detailed monitoring and metrics
Authentication and user-specific tracked products
Pagination for large tracked-product lists
Author

Sugandha Tiwari

B.Tech Computer Science Engineering

GitHub: https://github.com/sugandhatiwari01/webscraper


### One thing I would change before committing

Don't put your **actual Supabase service-role key or CRON secret** anywhere in this README. Keep only the placeholders shown above.

Also add a `.env.example` containing the same placeholder variables.