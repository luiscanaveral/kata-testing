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
        Backend->>DB: INSERT IGNORE INTO bucket_counters (ensures row exists)
        Backend->>DB: UPDATE bucket_counters SET next_counter = LAST_INSERT_ID(next_counter + 1)
        DB-->>Backend: Counter value via SELECT LAST_INSERT_ID()
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
    URL --> Counter["INSERT IGNORE\n+ UPDATE ... LAST_INSERT_ID(next_counter+1)\n→ atomic counter"]
    Counter --> B62_C["base62 encode\n→ 5 chars"]
    B62_B --> Combine["short_code\n= bucket_part + counter_part"]
    B62_C --> Combine
    Combine --> Result["7-char short code\ne.g. 'a3G0001'"]
```

The first 2 characters encode the bucket (0-999, giving 62² = 3844 possible values, well above the 1000 needed). The remaining 5 characters encode the counter (up to 62⁵ ≈ 916 million per bucket).

Because the bucket is derived from the URL content (via MD5), the same URL always falls into the same bucket. Combined with deduplication in `create_short_url`, identical URLs always produce the same short code.

### Worked Examples

#### Example 1: `https://example.com`

| Step | Calculation | Result |
|------|-------------|--------|
| MD5 hash | `md5("https://example.com")` | `f1c1592588411002af340cbaedd6fc8d` |
| bucket_id | first 8 hex → `0xf1c15925` = 4057319717 → `4057319717 % 1000` | **717** |
| base62(bucket) | `717 ÷ 62 = 11 rem 35` → `[11, 35]` → `11=b`, `35=Z` | **`bZ`** |
| next_counter | atomic `LAST_INSERT_ID(next_counter + 1)` | **1** |
| base62(counter) | `1 ÷ 62 = 0 rem 1` → `[0, 0, 0, 0, 1]` → `A, A, A, A, B` | **`AAAAB`** |
| short_code | bucket part + counter part | **`bZAAAAB`** |

The hex chars `f1c15925` are read as a **big-endian 32-bit unsigned integer** (0xf1c15925 = 4057319717), then reduced modulo 1000 to get bucket 717.

#### Example 2: `https://google.com`

| Step | Calculation | Result |
|------|-------------|--------|
| MD5 hash | `md5("https://google.com")` | `1d5920f4b44b27a802bd77c4f05327ea` |
| bucket_id | first 8 hex → `0x1d5920f4` = 493153012 → `493153012 % 1000` | **12** |
| base62(bucket) | `12 ÷ 62 = 0 rem 12` → `[0, 12]` → `0=A`, `12=C` | **`AC`** |
| next_counter | atomic `LAST_INSERT_ID(next_counter + 1)` | **1** |
| base62(counter) | `1 ÷ 62 = 0 rem 1` → `[0, 0, 0, 0, 1]` → `A, A, A, A, B` | **`AAAAB`** |
| short_code | bucket part + counter part | **`ACAAAAB`** |

Note both examples got counter=1 because they fall into different buckets (717 and 12), so each bucket's counter starts fresh at 1.

#### Base62 Alphabet

The encoding uses `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz` (0-indexed). To encode an integer, repeatedly divide by 62: the remainder gives the rightmost character, the quotient feeds the next position leftward.

```
0→0, 1→1, ..., 9→9, 10→A, 11→B, ..., 35→Z, 36→a, ..., 61→z
```

**bucket_id → 2 chars:** `n = bucket_id`, output `[n/62², (n/62)%62, n%62]` (big-endian).

**counter → 5 chars:** `n = counter`, output `[n/62⁴, (n/62³)%62, (n/62²)%62, (n/62)%62, n%62]` (big-endian).

### Concurrency Safety

Counter allocation uses MySQL's `LAST_INSERT_ID(next_counter + 1)` inside `UPDATE`. This is atomic at the statement level — the UPDATE acquires an exclusive row lock, increments, and returns the new value in one operation. Two concurrent requests for the same bucket are serialized by MySQL's row-level locking, guaranteeing unique counters without application-level retries.

## Testing Architecture

```mermaid
graph TB
    subgraph Tests["Playwright Tests (21 total)"]
        direction TB
        E2E["E2E Tests (11)\nBrowser-based UI tests"]
        INT["Integration Tests (6)\nAPI + DB validation"]
        CON["Concurrency Tests (4)\nRace condition verification"]
    end

    subgraph Targets["Test Targets"]
        E2E -->|tag @e2e| make_e2e["make test-e2e"]
        INT -->|tag @integration| make_int["make test-integration"]
        CON -->|tag @concurrency| make_con["make test-concurrency"]
        E2E -->|all tests| make_all["make test"]
        INT -->|all tests| make_all
        CON -->|all tests| make_all
    end

    subgraph Env["Environment Variables"]
        API["API_URL=http://localhost:4000"]
        FE["FRONTEND_URL=http://localhost:4002"]
        DB_HOST["MYSQL_HOST=127.0.0.1"]
    end

    make_all --> Env
    make_e2e --> Env
    make_int --> Env
    make_con --> Env
```

### Concurrency Tests

Four tests verify the system's behavior under concurrent load:

| Test | What it validates |
|------|-------------------|
| Same URL 15 times | Dedup returns identical short_code |
| 30 different URLs | All short_codes are unique |
| 50 URLs globally | No short_code collisions at scale |
| 3 URLs x 10 each each | Batch dedup consistency across URLs |

Integration tests call the REST API directly via Playwright's `request` fixture and verify persistence by querying MySQL with `mysql2`. E2E tests run a real Chromium browser against the frontend and interact with the UI through Playwright locators.
