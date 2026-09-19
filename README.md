# INE Price Tracker

Full-stack assignment for tracking product price and stock from the INE hosted mock store.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Scraper: HTTP + Cheerio, with Playwright fallback
- Database: Supabase PostgreSQL
- Scheduler: cron-job.org
- Hosting: Vercel + Render

## Architecture

React -> Express -> Supabase
                 |
                 +-> INE mock store
                 |
cron-job.org ----+

The scraper uses lightweight HTTP fetching first. If the page does not contain a valid
price/stock result, or the HTTP request fails, it retries and can fall back to Playwright.

## Local setup

### 1. Database

Create a Supabase project and run `database/schema.sql` in the SQL editor.

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Environment variables

Backend:

- `PORT`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STORE_BASE_URL`
- `SCRAPE_TIMEOUT_MS`
- `MAX_RETRIES`
- `PLAYWRIGHT_TIMEOUT_MS`
- `FRONTEND_URL`
- `CRON_SECRET`

Frontend:

- `VITE_API_URL`

Never commit real Supabase keys.

## Scraping schedule

The production scraper is triggered externally every 2 hours:

cron-job.org -> `POST /api/scrape/run`

Do not rely on `setInterval()` because free-tier Render instances may sleep.

## Reliability strategy

1. HTTP fetch is attempted first.
2. Every attempt has a timeout.
3. Retryable failures are logged.
4. HTML extraction is validated before data is stored.
5. Invalid/missing price or stock never overwrites good history.
6. Playwright is used as a fallback when dynamic rendering is genuinely required.
7. Each attempt is persisted in `scrape_logs`.
8. A single product failure does not stop the remaining products.
9. Unexpected page structure is treated as a scrape failure, not as empty/zero data.

## Headed run

```bash
cd backend
npm run scrape:headed
```

This launches Chromium visibly and runs the scraper against a tracked product.

Set `HEADED_PRODUCT_URL` in `.env` for the recording.

## Deployment

- Deploy `frontend/` to Vercel.
- Deploy `backend/` to Render.
- Add production environment variables.
- Configure cron-job.org to call `POST /api/scrape/run` every 2 hours with the `x-cron-secret` header.

## Design note

See `DESIGN-NOTE.md`. Update the AI-first-attempt section with the actual mistakes discovered during implementation/testing rather than inventing them.
