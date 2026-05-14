# URL Shortener

A scoped short code URL shortener built with FastAPI, Next.js, MySQL, and Playwright.

## Architecture

Two components manage short code generation:

- **Bucket** — the URL's hash determines which of 1000 buckets it falls into (encoded as 2 base62 chars).
- **Counter** — a per-bucket monotonic counter (encoded as 5 base62 chars), allocated via MySQL's `LAST_INSERT_ID()` for safe concurrency.

This produces 7-character short codes with no coordination between instances.

## Quick Start

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:4002 |
| Backend API | http://localhost:4000 |
| MySQL | localhost:3306 |

## Running Tests

```bash
make test          # All 21 tests (E2E + integration + concurrency)
make test-e2e      # Only E2E (11)
make test-integration  # Only integration (6)
make test-concurrency  # Only concurrency (4)
```

## Local Development

```bash
make backend     # uvicorn on :4000
make frontend    # next dev on :4002
```

## Make Targets

| Target | Description |
|--------|-------------|
| `up` | Build and start all Docker services |
| `down` | Stop and remove all containers |
| `build` | Build all Docker images |
| `test` | Run all Playwright tests locally |
| `test-e2e` | Run only E2E tests |
| `test-integration` | Run only integration tests |
| `test-concurrency` | Run only concurrency/race tests |
| `backend` | Run backend locally with uvicorn |
| `frontend` | Run frontend locally with next dev |

## Environment

All configuration lives in `.env` at the project root.

| Variable | Default | Description |
|----------|---------|-------------|
| `MYSQL_DATABASE` | `urlshortener` | Database name |
| `MYSQL_USER` | `urlshortener` | Database user |
| `MYSQL_PASSWORD` | `urlshortener123` | Database password |
| `MYSQL_HOST` | `db` | Database host (Docker service name) |
| `MYSQL_PORT` | `3306` | Database port |
| `BACKEND_PORT` | `4000` | Host-mapped backend port |
| `BASE_URL` | `http://localhost:4000` | Base URL for generated short links |
| `FRONTEND_PORT` | `4002` | Host-mapped frontend port |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | API URL the frontend browser calls |
| `SHORT_CODE_LENGTH` | `7` | Length of generated short codes |
| `BUCKET_SIZE` | `1000` | Number of buckets for scoped counter |
