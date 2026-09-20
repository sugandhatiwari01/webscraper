# INE Price Tracker

A full-stack app for tracking price and stock changes on the INE demo storefront. Users can search the catalog, add products to a watchlist, trigger manual scrapes, and inspect historical pricing and audit logs.

## Live demo

- Frontend: https://webscraper-dusky.vercel.app
- Backend API: https://webscraper-1-2xb3.onrender.com
- Store: https://demo.inelabteamdev.com

## What it does

- Search products by keyword or product ID
- Track products for ongoing monitoring
- Scrape current price, MRP, discount, stock, seller, and scrape duration
- Keep a price history for each tracked product
- Record successful and failed scrape attempts in dedicated logs
- Trigger manual scrapes or run the full tracked-product batch through a protected cron endpoint
- View product history and logs in a small React dashboard

## Tech stack

- Frontend: React, Vite, Recharts
- Backend: Node.js, Express
- Scraping: Playwright, Cheerio
- Database: Supabase + PostgreSQL
- Deployment: Vercel for frontend, Render for backend

## Architecture

```text
INE storefront (demo.inelabteamdev.com)
        |
        | HTTP + browser-based price reveal
        v
Frontend (React + Vite) -- fetches --> Backend API (Node.js + Express)
                                            |
                                            | stores tracked products
                                            v
                                      Supabase PostgreSQL
                                            |
                                            | price history + scrape logs
                                            v
                                   Scheduled cron job / manual triggers
```

## Project structure

```text
.
├── backend/
│   ├── scraper/
│   │   ├── extract.js
│   │   ├── find-search.js
│   │   ├── headed.js
│   │   ├── inspect-store.js
│   │   ├── run.js
│   │   ├── scrape.js
│   │   ├── store.js
│   │   ├── test-catalog.js
│   │   └── test-search.js
│   ├── package.json
│   ├── server.js
│   └── Dockerfile
├── database/
│   └── schema.sql
├── frontend/
│   ├── src/
│   ├── index.html
│   ├── package.json
│   └── vite.config.*
├── DESIGN-NOTE.md
├── README.md
└── .env.example (recommended)
```

## Prerequisites

- Node.js 18+ recommended
- npm
- A Supabase project with PostgreSQL enabled
- Access to the INE demo storefront

## Local setup

### 1. Install dependencies

Backend:

```bash
cd backend
npm install
```

Frontend:

```bash
cd frontend
npm install
```

### 2. Set environment variables

Create a `.env` file in the backend folder with values like:

```env
PORT=5000
STORE_BASE_URL=https://demo.inelabteamdev.com
FRONTEND_URL=http://localhost:5173
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CRON_SECRET=your-secret-token
```

Create a `.env` file in the frontend folder if needed:

```env
VITE_API_URL=http://localhost:5000
```

### 3. Initialize the database

Apply the schema in `database/schema.sql` to your Supabase database using the Supabase SQL editor or psql.

### 4. Start the app

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

The frontend runs at http://localhost:5173 and the backend at http://localhost:5000.

## Available scripts

### Backend

```bash
npm run dev
npm run start
npm run scrape:headed
npm run scrape:run
```

### Frontend

```bash
npm run dev
npm run build
npm run preview
```

## API endpoints

### Health check

```http
GET /api/health
```

### Search products

```http
GET /api/products/search?q=keyboard
```

### Get tracked products

```http
GET /api/products/tracked
```

### Track a product

```http
POST /api/products/track
Content-Type: application/json
```

Example body:

```json
{
  "productId": 120
}
```

### Run a single scrape

```http
POST /api/scrape/run
Content-Type: application/json
```

Example body:

```json
{
  "productId": 120
}
```

### Run all tracked products

```http
POST /api/scrape/run-all
Authorization: Bearer <CRON_SECRET>
```

This route verifies the shared secret and then scrapes every active tracked product sequentially.

### Price history

```http
GET /api/products/:productId/history
```

### Scrape logs

```http
GET /api/products/:productId/logs
```

## Scraping behavior

The app uses a hybrid extraction strategy:

- HTTP + Cheerio for standard catalog and metadata fetches
- Playwright for the final price reveal flow when the storefront requires browser interaction before the price becomes visible

The backend stores both successful and failed attempts in `scrape_logs`, so failures remain observable instead of being silently dropped.

## Notes

- This project is tailored to the INE demo storefront and may need adjustments if the target site changes its DOM or API responses.
- The cron endpoint is protected with `CRON_SECRET` and is intended for external schedulers such as cron-job.org.
- A slower verified scrape is preferred over silently recording incorrect price data.

## License

This project is intended for local or internal use unless you add your own license file.
