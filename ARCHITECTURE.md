# Architecture

## Container Topology

```mermaid
graph TB
    subgraph Host["Host Machine"]
        Browser["Browser / Playwright"]
        Make["make test"]
    end

    subgraph Docker["Docker Network"]
        direction TB
        Frontend["frontend:3000\nNext.js 15"]
        Backend["backend:8000\nFastAPI"]
        DB["db:3306\nMySQL 8.0"]
        Frontend --> Backend
        Backend --> DB
    end

    Browser -- "localhost:4002" --> Frontend
    Browser -- "localhost:4000" --> Backend
    Make -- "MYSQL_HOST=127.0.0.1:3306" --> DB
```

## Port Mapping

| Service | Container Port | Host Port |
|---------|---------------|-----------|
| Frontend | 3000 | 4002 |
| Backend | 8000 | 4000 |
| MySQL | 3306 | 3306 |

## URL Shortening Flow

```mermaid
sequenceDiagram
    participant User as User/Browser
    participant Frontend as Frontend (Next.js)
    participant Backend as Backend (FastAPI)
    participant DB as MySQL

    User->>Frontend: Enter long URL, click Shorten
    Frontend->>Backend: POST /shorten { long_url }
    Backend->>DB: SELECT * FROM url_mappings WHERE long_url = ?
    alt URL already exists
        DB-->>Backend: Existing row
        Backend-->>Frontend: { short_url, short_code, long_url }
    else New URL
        Backend->>Backend: get_bucket(url) → bucket_id (MD5 % 1000)
        Backend->>DB: SELECT ... FOR UPDATE FROM bucket_counters WHERE bucket_id = ?
        DB-->>Backend: next_counter (or None)
        Backend->>Backend: Increment counter
        Backend->>DB: UPDATE bucket_counters SET next_counter += 1
        Backend->>Backend: base62(bucket_id) + base62(counter) → short_code
        Backend->>DB: INSERT INTO url_mappings (short_code, long_url, ...)
        Backend->>DB: COMMIT
        Backend-->>Frontend: { short_url, short_code, long_url }
    end
    Frontend-->>User: Display short URL + Copy button
```

## URL Resolution Flow

```mermaid
sequenceDiagram
    participant Client as Client (browser/curl)
    participant Backend as Backend (FastAPI)
    participant DB as MySQL

    Client->>Backend: GET /{short_code}
    Backend->>DB: SELECT long_url FROM url_mappings WHERE short_code = ?
    alt Found
        DB-->>Backend: long_url
        Backend-->>Client: 200 { long_url }
    else Not found
        DB-->>Backend: empty
        Backend-->>Client: 404 { detail: "Short URL not found" }
    end
```

## Database Schema

```mermaid
erDiagram
    url_mappings {
        bigint id PK
        varchar short_code UK "7 chars, base62"
        varchar long_url "Original URL (2048)"
        int bucket_id "0-999, indexed"
        bigint counter "Monotonic per bucket"
    }

    bucket_counters {
        int bucket_id PK "0-999"
        bigint next_counter "Next value to assign"
    }
```

## Short Code Generation

```mermaid
flowchart LR
    URL["Long URL"] --> MD5["MD5 hash"]
    MD5 --> Bucket["First 8 hex chars\n→ int % 1000\n→ bucket_id"]
    Bucket --> B62_B["base62 encode\n→ 2 chars"]
    URL --> Counter["bucket_counters\nSELECT ... FOR UPDATE\n→ next_counter"]
    Counter --> B62_C["base62 encode\n→ 5 chars"]
    B62_B --> Combine["short_code\n= bucket_part + counter_part"]
    B62_C --> Combine
    Combine --> Result["7-char short code\ne.g. 'a3G0001'"]
```

The first 2 characters encode the bucket (0-999, giving 62² = 3844 possible values, well above the 1000 needed). The remaining 5 characters encode the counter (up to 62⁵ ≈ 916 million per bucket).

Because the bucket is derived from the URL content (via MD5), the same URL always falls into the same bucket. Combined with deduplication in `create_short_url`, identical URLs always produce the same short code.

## Testing Architecture

```mermaid
graph TB
    subgraph Tests["Playwright Tests"]
        direction TB
        E2E["E2E Tests (11)\nBrowser-based UI tests"]
        INT["Integration Tests (5)\nAPI + DB validation"]
    end

    subgraph Targets["Test Targets"]
        E2E -->|tag @e2e| make_e2e["make test-e2e"]
        INT -->|tag @integration| make_int["make test-integration"]
        E2E -->|all tests| make_all["make test"]
        INT -->|all tests| make_all
    end

    subgraph Env["Environment Variables"]
        API["API_URL=http://localhost:4000"]
        FE["FRONTEND_URL=http://localhost:4002"]
        DB_HOST["MYSQL_HOST=127.0.0.1"]
    end

    make_all --> Env
    make_e2e --> Env
    make_int --> Env
```

Integration tests call the REST API directly via Playwright's `request` fixture and verify persistence by querying MySQL with `mysql2`. E2E tests run a real Chromium browser against the frontend and interact with the UI through Playwright locators.
