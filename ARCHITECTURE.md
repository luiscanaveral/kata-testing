# Architecture

## System Overview

```mermaid
graph TB
    subgraph "Client"
        B[Browser / curl]
    end

    subgraph "Docker Compose"
        subgraph "Frontend"
            N["Next.js App<br/>Port 3000"]
        end

        subgraph "Backend"
            F["FastAPI Server<br/>Port 8000"]
            S["Shortener Engine<br/>bucket + base62"]
        end

        subgraph "Database"
            M[("MySQL 8.0<br/>Port 3306")]
        end

        subgraph "Testing"
            P["Playwright Tests<br/>E2E + Integration"]
        end
    end

    B -- "POST /shorten" --> N
    B -- "GET /{short_code}" --> F
    N -- "POST /shorten (API)" --> F
    F -- "CRUD" --> M
    P -- "HTTP checks" --> N
    P -- "HTTP checks" --> F
    P -- "SQL queries" --> M
```

## URL Shortening Flow

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Frontend (Next.js)
    participant API as Backend (FastAPI)
    participant DB as MySQL

    U->>UI: Paste long URL + click Shorten
    UI->>API: POST /shorten { long_url }
    API->>DB: SELECT from url_mappings WHERE long_url = ?
    alt URL already exists
        DB-->>API: existing row
        API-->>UI: { short_url, short_code, long_url }
    else new URL
        API->>API: MD5(long_url) % BUCKET_SIZE → bucket_id
        API->>DB: SELECT ... FOR UPDATE from bucket_counters WHERE bucket_id = ?
        DB-->>API: current counter
        API->>DB: UPDATE bucket_counters SET counter += 1
        API->>API: base62(bucket_id) + base62(counter) → short_code
        API->>DB: INSERT into url_mappings
        DB-->>API: OK
        API-->>UI: { short_url, short_code, long_url }
    end
    UI-->>U: Display short URL + Copy button
```

## URL Redirect Flow

```mermaid
sequenceDiagram
    actor U as User
    participant API as Backend (FastAPI)
    participant DB as MySQL

    U->>API: GET /{short_code}
    API->>DB: SELECT long_url FROM url_mappings WHERE short_code = ?
    alt exists
        DB-->>API: long_url
        API-->>U: 200 { long_url }
    else not found
        DB-->>API: empty
        API-->>U: 404 { detail: "Short URL not found" }
    end
```

## Bucket Strategy

```mermaid
flowchart TD
    A["long_url"] --> B["MD5 hash"]
    B --> C["First 8 hex chars<br/>→ int"]
    C --> D["mod BUCKET_SIZE<br/>(1000)"]
    D --> E["bucket_id (0-999)"]

    E --> F["SELECT ... FOR UPDATE<br/>bucket_counters"]
    F --> G["next_counter value"]
    G --> H["counter += 1"]

    E --> I["base62(bucket_id)<br/>padded to 2 chars"]
    H --> J["base62(counter)<br/>padded to 5 chars"]

    I --> K["short_code<br/>(7 chars total)"]
    J --> K

    K --> L["INSERT url_mappings<br/>(short_code, long_url, bucket_id, counter)"]
```

## Testing Pyramid

```mermaid
flowchart TB
    subgraph "E2E Tests"
        T1["UI form submit → short URL displayed"]
        T2["Short URL resolves to original"]
        T3["Copy button visible after shorten"]
        T4["Loading state during request"]
        T5["Error state on API failure"]
    end

    subgraph "Integration Tests"
        T6["POST /shorten → DB record created"]
        T7["GET /{code} → resolves long URL"]
        T8["Duplicate URL → same short code"]
        T9["Unknown code → 404"]
        T10["Bucket counters increment"]
    end

    subgraph "Unit Tests"
        T11["base62 encode/decode"]
        T12["get_bucket distribution"]
        T13["short_code format validation"]
    end

    T11 --> T12 --> T13
    T6 --> T7 --> T8 --> T9 --> T10
    T1 --> T2 --> T3 --> T4 --> T5
```

## Directory Layout

```
kata-testing/
├── .env                  # Shared env vars (DB creds, ports, config)
├── docker-compose.yml    # Orchestrates db + backend + frontend + tests
├── Makefile              # Dev workflow shortcuts
├── ARCHITECTURE.md       # This file
├── AGENTS.md             # Commands reference
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py       # FastAPI routes
│       ├── database.py   # SQLAlchemy + MySQL connection
│       ├── models.py     # ORM models (UrlMapping, BucketCounter)
│       ├── schemas.py    # Pydantic request/response schemas
│       └── shortener.py  # Bucket strategy + base62 encoding
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   └── app/
│       ├── layout.tsx
│       ├── page.tsx      # URL shortener form UI
│       └── globals.css
│
└── testing/
    ├── Dockerfile
    ├── entrypoint.sh      # Wait for services → run tests
    ├── playwright.config.ts
    └── tests/
        ├── url-shortener.e2e.spec.ts
        └── url-shortener.integration.spec.ts
```
