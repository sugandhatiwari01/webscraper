# Design Note

## Goal

Track the current price and stock of products from the INE mock store while preserving an honest record of scraper attempts.

## Scraping design

The scraper deliberately prefers HTTP + HTML parsing because it is cheaper and faster than launching a browser for every product. Playwright is a fallback for pages whose useful data is rendered asynchronously.

## Reliability

### Timeouts
Every network/browser operation has an explicit timeout.

### Retries
Retryable failures such as timeouts, temporary HTTP errors, and transient navigation failures are retried with increasing delays.

### Validation
A scrape is considered successful only if:
- the product page is reachable;
- the expected product can be identified;
- a valid numeric price is extracted;
- stock can be classified into a known state.

A failed or ambiguous scrape does not create a price-history row.

### Honest logging
Every attempt gets a `scrape_logs` record. A retry is visible rather than hidden. A final failure is recorded as failed.

### Batch isolation
Each tracked product is scraped independently. One failure does not abort the whole scheduled run.

### Structure-change detection
The extractor throws a structured error when required fields disappear. This can later be surfaced as a page-structure warning.

## HTTP vs browser trade-off

HTTP parsing is preferred for speed, memory use, and Render free-tier constraints. Playwright is reserved for cases where the mock store genuinely requires JavaScript rendering or when the HTTP response cannot produce a validated result.

## Scheduling

An external cron service is used because free-tier backend processes can sleep. The cron service invokes the backend every two hours.

## AI-first-attempt corrections

This section should be filled with the actual failures observed during implementation. For example:
- an overly broad price selector;
- treating an empty selector result as zero;
- relying on a fixed sleep rather than waiting for a condition;
- failing to isolate one product's error from the batch.

Do not claim any of these happened unless testing confirms it.

## Trade-offs

The implementation favors correctness and observability over maximum scraping throughput. A slower, validated scrape is preferable to silently storing incorrect price data.
