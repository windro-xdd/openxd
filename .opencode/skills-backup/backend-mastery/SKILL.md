# Backend Mastery — Deep Systems Engineering

## Description
Elite backend engineering skill covering system design (distributed systems, microservices, event-driven architecture), database mastery (PostgreSQL internals, indexing strategies, query optimization, connection pooling, migrations, replication, sharding), API design (REST maturity model, GraphQL schema design, gRPC, WebSocket, SSE, tRPC), authentication & authorization (OAuth 2.0 flows, OIDC, JWTs done right, RBAC, ABAC, session management), caching strategies (Redis patterns, CDN, HTTP caching, invalidation), message queues (Kafka, RabbitMQ, SQS patterns, dead letter queues, exactly-once), observability (structured logging, distributed tracing, metrics, alerting), performance (N+1 queries, connection pools, backpressure, circuit breakers, rate limiting), and deployment (Docker, Kubernetes, CI/CD, zero-downtime deploys, feature flags). Not surface-level — this is production-grade knowledge from operating systems at scale. Use when: building APIs, designing databases, system architecture, scaling services, debugging performance issues, implementing auth, caching, message queues, observability, deployment.

## Trigger Keywords
backend, API, REST, GraphQL, gRPC, database, PostgreSQL, MySQL, MongoDB, Redis, cache, queue, Kafka, RabbitMQ, microservice, monolith, authentication, authorization, OAuth, JWT, session, rate limiting, load balancing, Docker, Kubernetes, CI/CD, deployment, migration, index, query optimization, connection pool, WebSocket, SSE, serverless, Lambda, edge function, worker

---

## 🏗️ SYSTEM DESIGN — Architecture Patterns

### Monolith vs Microservices — The Honest Truth
```
START WITH A MONOLITH. Always.

Monolith advantages:
- Simple to develop, test, deploy
- No distributed system complexity (no network calls between services)
- Shared database = ACID transactions across all domains
- One codebase = easy refactoring across boundaries
- One deployment = no service version compatibility issues

When to CONSIDER microservices:
- Team size > 30-50 engineers (Conway's Law)
- Different scaling requirements per domain
- Independent deployment cadence needed
- Different technology requirements per domain
- Regulatory isolation requirements

The "modular monolith" is usually the sweet spot:
- Monolith deployment
- Clean domain boundaries (modules)
- Well-defined internal APIs between modules
- Can extract to microservice LATER when you have evidence

NEVER start with microservices because:
- "It's more scalable" → you don't have scale problems yet
- "Netflix does it" → you're not Netflix
- "It's more modern" → complexity is not modernity
```

### Event-Driven Architecture
```
Three patterns (different trade-offs):

1. EVENT NOTIFICATION (fire and forget)
   OrderService → publishes "OrderCreated" → anyone can listen
   No response expected. Publisher doesn't know/care who listens.
   Use for: analytics, notifications, audit logs

2. EVENT-CARRIED STATE TRANSFER (replicate data)
   CustomerService → publishes "CustomerUpdated {name, email, address}"
   Other services maintain local copy of customer data.
   Eliminates synchronous queries. Eventual consistency.
   Use for: reducing cross-service calls, read-heavy workloads

3. EVENT SOURCING (store events as truth)
   Don't store current state. Store sequence of events.
   Account state = replay(AccountOpened, Deposited(100), Withdrawn(30), ...)
   Current balance derived from event history.
   Use for: audit trails, temporal queries, undo/redo

   WITH CQRS (Command Query Responsibility Segregation):
   Write side → events → Event Store
   Read side → projections → Optimized read models (different schema)
```

### Distributed Systems — The Hard Parts
```
CAP Theorem:
  Consistency — every read gets the most recent write
  Availability — every request gets a response
  Partition tolerance — system works despite network failures
  Pick 2 (you MUST pick P in distributed systems, so it's really C vs A)

  CP: PostgreSQL (single primary), etcd, ZooKeeper
  AP: Cassandra, DynamoDB, CouchDB
  Most systems: tunable consistency (e.g., DynamoDB: strong or eventual per query)

Consensus:
  Raft — leader election, log replication (etcd, CockroachDB, TiKV)
  Paxos — complex but proven (Google Spanner)
  You almost never implement these yourself.

Patterns for reliability:
  Circuit Breaker — stop calling failing service, fail fast
  Retry with exponential backoff + jitter
  Bulkhead — isolate failures (separate thread pools per dependency)
  Timeout — ALWAYS set timeouts on external calls
  Fallback — degrade gracefully (cached data, default response)
  Idempotency keys — safe to retry (PUT /orders/123, not POST /orders)
```

---

## 🗄️ DATABASE — PostgreSQL Deep Dive

### Indexing Strategy (the #1 performance lever)
```sql
-- B-tree (default) — equality and range queries
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_orders_date ON orders (created_at DESC);

-- Composite index — column order matters!
-- Supports: (a), (a, b), (a, b, c) — NOT (b), (b, c), (c)
CREATE INDEX idx_orders_user_date ON orders (user_id, created_at DESC);
-- This ONE index covers:
-- WHERE user_id = X
-- WHERE user_id = X AND created_at > Y
-- WHERE user_id = X ORDER BY created_at DESC

-- Partial index — index only what you need
CREATE INDEX idx_active_users ON users (email)
  WHERE deleted_at IS NULL AND status = 'active';
-- Smaller index, faster queries for common case

-- Covering index (includes) — avoid table lookup entirely
CREATE INDEX idx_orders_covering ON orders (user_id, created_at DESC)
  INCLUDE (total, status);
-- Query can be satisfied entirely from the index (Index-Only Scan)

-- GIN (Generalized Inverted Index) — arrays, JSONB, full-text search
CREATE INDEX idx_tags ON articles USING GIN (tags);
-- WHERE tags @> ARRAY['javascript', 'react']

CREATE INDEX idx_metadata ON products USING GIN (metadata jsonb_path_ops);
-- WHERE metadata @> '{"color": "red"}'

-- GiST — geographic, range, nearest-neighbor
CREATE INDEX idx_location ON stores USING GIST (coordinates);
-- WHERE coordinates <-> point(40.7128, -74.0060) < 0.1

-- BRIN (Block Range INdex) — huge tables with natural ordering
CREATE INDEX idx_logs_time ON logs USING BRIN (created_at);
-- Tiny index for time-series data (1000x smaller than B-tree)

-- Expression index
CREATE INDEX idx_lower_email ON users (LOWER(email));
-- WHERE LOWER(email) = 'user@example.com'
```

### Query Optimization
```sql
-- EXPLAIN ANALYZE — always use ANALYZE (actually runs the query)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM orders WHERE user_id = 123 AND status = 'pending';

-- What to look for in output:
-- Seq Scan → MISSING INDEX (on large tables)
-- Nested Loop → fine for small sets, bad for large joins
-- Hash Join → good for large equi-joins
-- Sort → consider adding ORDER BY columns to index
-- Buffers: shared hit vs read → cache hit rate

-- N+1 query problem (THE most common backend perf issue)
-- BAD:
SELECT * FROM users;
-- Then for EACH user:
SELECT * FROM orders WHERE user_id = ?;
-- = 101 queries for 100 users

-- GOOD: JOIN or subquery
SELECT u.*, o.*
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.created_at > '2026-01-01';

-- Or lateral join (correlated subquery per row)
SELECT u.*, recent_orders.*
FROM users u
CROSS JOIN LATERAL (
  SELECT * FROM orders o
  WHERE o.user_id = u.id
  ORDER BY o.created_at DESC
  LIMIT 3
) recent_orders;

-- Pagination: DON'T use OFFSET for large datasets
-- BAD (reads and discards rows):
SELECT * FROM products ORDER BY id LIMIT 20 OFFSET 10000;

-- GOOD (cursor/keyset pagination):
SELECT * FROM products
WHERE id > :last_seen_id
ORDER BY id
LIMIT 20;

-- Window functions (avoid self-joins)
SELECT
  user_id,
  amount,
  SUM(amount) OVER (PARTITION BY user_id ORDER BY created_at) as running_total,
  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY amount DESC) as rank,
  LAG(amount) OVER (PARTITION BY user_id ORDER BY created_at) as prev_amount,
  amount - LAG(amount) OVER (PARTITION BY user_id ORDER BY created_at) as diff
FROM orders;

-- CTE (Common Table Expression) for readable complex queries
WITH monthly_revenue AS (
  SELECT
    DATE_TRUNC('month', created_at) as month,
    SUM(total) as revenue
  FROM orders
  WHERE status = 'completed'
  GROUP BY 1
),
growth AS (
  SELECT
    month,
    revenue,
    LAG(revenue) OVER (ORDER BY month) as prev_month,
    ROUND((revenue - LAG(revenue) OVER (ORDER BY month)) /
      LAG(revenue) OVER (ORDER BY month) * 100, 2) as growth_pct
  FROM monthly_revenue
)
SELECT * FROM growth ORDER BY month DESC;
```

### Connection Pooling
```
Database connections are EXPENSIVE:
- Each connection = ~10MB memory on PostgreSQL
- max_connections default = 100
- Creating a connection = TCP handshake + TLS + auth = 50-100ms

Use a connection pooler:
  PgBouncer (external, most common)
  pgpool-II (more features, more complex)
  Built-in pool (application-level: HikariCP, node-postgres pool)

Pool sizing formula (BoneCP/HikariCP):
  pool_size = cpu_cores * 2 + disk_spindles
  For SSD: pool_size = cpu_cores * 2 + 1
  For 4-core server: pool_size = 9

  More connections ≠ faster. Contention INCREASES with too many connections.
  10-20 connections handles thousands of concurrent requests when pooled properly.

PgBouncer modes:
  session — connection held until client disconnects (least efficient)
  transaction — connection returned after each transaction (recommended)
  statement — connection returned after each statement (no multi-statement txns)
```

### Migrations Best Practices
```sql
-- NEVER do these in a migration on a live database:
-- ❌ ALTER TABLE large_table ADD COLUMN with DEFAULT (locks table in PG < 11)
-- ❌ CREATE INDEX (blocks writes) — use CONCURRENTLY
-- ❌ ALTER TABLE ... ALTER COLUMN TYPE (rewrites entire table)
-- ❌ RENAME COLUMN (breaks running code)

-- Safe migration patterns:

-- 1. Add nullable column (instant, no lock)
ALTER TABLE users ADD COLUMN phone TEXT;

-- 2. Backfill in batches (not one giant UPDATE)
UPDATE users SET phone = 'unknown'
WHERE id BETWEEN 1 AND 10000
AND phone IS NULL;

-- 3. Add NOT NULL constraint after backfill
ALTER TABLE users ALTER COLUMN phone SET NOT NULL;

-- 4. Create index concurrently (no lock, but slower)
CREATE INDEX CONCURRENTLY idx_users_phone ON users (phone);

-- 5. Rename column safely (expand → migrate → contract)
-- Step 1: Add new column
ALTER TABLE users ADD COLUMN full_name TEXT;
-- Step 2: Dual-write in application code
-- Step 3: Backfill old data
UPDATE users SET full_name = name WHERE full_name IS NULL;
-- Step 4: Switch reads to new column
-- Step 5: Stop writing old column
-- Step 6: Drop old column (next deploy)
ALTER TABLE users DROP COLUMN name;

-- 6. Add foreign key without locking
ALTER TABLE orders ADD CONSTRAINT fk_user
  FOREIGN KEY (user_id) REFERENCES users(id)
  NOT VALID; -- Don't validate existing rows (instant)
-- Then validate in background:
ALTER TABLE orders VALIDATE CONSTRAINT fk_user; -- Doesn't lock
```

---

## 🔌 API DESIGN — REST, GraphQL, gRPC

### REST — Richardson Maturity Model
```
Level 0: One endpoint, POST everything (SOAP-style)
  POST /api { action: "getUser", id: 123 }

Level 1: Resources (nouns, not verbs)
  GET /users/123
  POST /users
  GET /orders/456

Level 2: HTTP methods + status codes
  GET    /users/123         → 200 (read)
  POST   /users             → 201 + Location header (create)
  PUT    /users/123         → 200 (full replace)
  PATCH  /users/123         → 200 (partial update)
  DELETE /users/123         → 204 (delete)

  Status codes that matter:
  200 OK, 201 Created, 204 No Content
  301 Moved Permanently, 304 Not Modified
  400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found
  409 Conflict, 422 Unprocessable Entity, 429 Too Many Requests
  500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable

Level 3: HATEOAS (Hypermedia)
  GET /users/123 →
  {
    "id": 123,
    "name": "Alice",
    "_links": {
      "self": { "href": "/users/123" },
      "orders": { "href": "/users/123/orders" },
      "update": { "href": "/users/123", "method": "PATCH" }
    }
  }
```

### API Design Rules
```
1. Use plural nouns: /users not /user
2. Nest for relationships: /users/123/orders
3. Filter with query params: /orders?status=pending&sort=-created_at
4. Pagination: cursor-based for feeds, offset for admin tables
   Link: <...?cursor=abc>; rel="next"
5. Versioning: URL (/v1/) or header (Accept: application/vnd.api.v1+json)
6. Consistent error format:
   {
     "error": {
       "code": "VALIDATION_ERROR",
       "message": "Invalid email format",
       "details": [
         { "field": "email", "message": "Must be a valid email address" }
       ]
     }
   }
7. Rate limiting headers:
   X-RateLimit-Limit: 100
   X-RateLimit-Remaining: 95
   X-RateLimit-Reset: 1609459200
   Retry-After: 30 (on 429)

8. Idempotency: POST with Idempotency-Key header
   Client generates UUID, server deduplicates
```

### Authentication — Done Right
```
SESSION-BASED (traditional, simpler):
  Login → server creates session → stores in Redis/DB
  Response: Set-Cookie: session_id=abc; HttpOnly; Secure; SameSite=Lax
  Every request: browser sends cookie automatically
  Logout: delete session server-side

  Advantages: server can revoke instantly, no token size in every request
  Disadvantages: requires shared session store for horizontal scaling

TOKEN-BASED (JWT):
  Login → server creates JWT → returns in response body
  Client stores in memory (NOT localStorage — XSS risk)
  Every request: Authorization: Bearer <token>

  JWT structure: header.payload.signature (base64url encoded)

  RULES:
  - Short expiry (15 minutes)
  - Use refresh tokens (stored in HttpOnly cookie) for renewal
  - Sign with RS256 (asymmetric) in production, not HS256
  - Never store sensitive data in payload (it's base64, not encrypted)
  - Include: sub, iat, exp, iss, aud
  - Validate ALL claims on every request

  Refresh token rotation:
  1. Client sends expired access token + refresh token
  2. Server validates refresh token, issues new access + new refresh
  3. Old refresh token is revoked
  4. If old refresh token is reused → compromise detected → revoke ALL tokens

OAUTH 2.0 FLOWS:
  Authorization Code + PKCE (web + mobile — ALWAYS use this)
  Client Credentials (machine-to-machine)
  Device Code (smart TV, CLI tools)

  NEVER use: Implicit flow (deprecated), Resource Owner Password (deprecated)

AUTHORIZATION PATTERNS:
  RBAC (Role-Based): user.role === 'admin' → simple, coarse
  ABAC (Attribute-Based): user.department === resource.department AND user.clearance >= resource.level → flexible
  ReBAC (Relationship-Based): user IS member OF org THAT owns resource → Zanzibar/SpiceDB model
```

---

## 📦 CACHING — The Performance Multiplier

### Cache Strategies
```
CACHE-ASIDE (Lazy Loading):
  Read: check cache → miss → read DB → write cache → return
  Write: write DB → invalidate cache
  Most common. Application manages cache.
  Risk: thundering herd on cold cache

READ-THROUGH:
  Read: check cache → miss → cache reads DB → return
  Cache manages itself. Application only talks to cache.

WRITE-THROUGH:
  Write: write cache → cache writes DB → return
  Guarantees cache consistency. Slower writes.

WRITE-BEHIND (Write-Back):
  Write: write cache → return immediately → async write to DB
  Fastest writes. Risk of data loss if cache crashes.

REFRESH-AHEAD:
  Cache proactively refreshes entries before they expire.
  Good for predictable access patterns.
```

### Redis Patterns
```
STRING — simple key-value
  SET user:123:name "Alice" EX 3600  → expires in 1 hour
  GET user:123:name

HASH — object fields
  HSET user:123 name "Alice" email "alice@x.com" plan "pro"
  HGET user:123 name
  HGETALL user:123

LIST — ordered collection (stack/queue)
  LPUSH notifications:123 "new_message"
  LRANGE notifications:123 0 9  → last 10

SET — unique items
  SADD online_users 123 456 789
  SISMEMBER online_users 123  → 1 (true)
  SCARD online_users  → 3 (count)

SORTED SET — ranked items
  ZADD leaderboard 1000 "user:123" 950 "user:456"
  ZRANGE leaderboard 0 9 REV WITHSCORES  → top 10

RATE LIMITING (sliding window):
  local key = "ratelimit:" .. user_id
  local count = redis.call("INCR", key)
  if count == 1 then redis.call("EXPIRE", key, window) end
  if count > limit then return 0 end  -- blocked
  return 1  -- allowed

DISTRIBUTED LOCK:
  SET lock:order:123 owner_id NX EX 30  → acquire (NX = only if not exists)
  -- Do work
  -- Release: only if still owner (Lua script to check and delete atomically)

CACHE INVALIDATION PATTERNS:
  1. TTL-based: SET key value EX 300 → auto-expire after 5 min
  2. Event-based: on DB write → DEL cache_key
  3. Tag-based: tag cache entries → invalidate by tag
  4. Version-based: cache key includes version → bump version to invalidate
```

### HTTP Caching
```
Cache-Control: public, max-age=31536000, immutable
  → CDN + browser cache for 1 year, never revalidate (hashed assets)

Cache-Control: private, no-cache
  → Browser only, always revalidate with server (ETag/If-None-Match)

Cache-Control: no-store
  → Never cache (sensitive data)

ETag flow:
  Server: ETag: "abc123"
  Client: If-None-Match: "abc123"
  Server: 304 Not Modified (no body sent)

Stale-While-Revalidate:
  Cache-Control: max-age=60, stale-while-revalidate=300
  → Serve stale for 5 min while refreshing in background
```

---

## 📊 OBSERVABILITY — Know What Your System Is Doing

### The Three Pillars

```
LOGS (events — what happened)
  Structured JSON, not plain text:
  {"level":"error","msg":"payment failed","user_id":"123","amount":99.99,"error":"card_declined","trace_id":"abc","timestamp":"2026-03-12T10:00:00Z"}

  Levels: DEBUG → INFO → WARN → ERROR → FATAL
  In production: INFO and above (DEBUG is too noisy)

METRICS (aggregates — how much/how often)
  Counter: requests_total, errors_total (monotonically increasing)
  Gauge: active_connections, queue_depth (goes up and down)
  Histogram: request_duration_seconds (distribution of values)

  RED method (for services):
    Rate — requests per second
    Errors — error rate
    Duration — latency distribution (p50, p95, p99)

  USE method (for resources):
    Utilization — CPU%, memory%, disk%
    Saturation — queue depth, thread pool exhaustion
    Errors — hardware/software errors

TRACES (request flow — where time is spent)
  Trace = collection of spans across services
  Span = single operation with timing + metadata

  User → API Gateway (span 1)
       → Auth Service (span 2)
       → Order Service (span 3)
         → Database (span 4)
         → Payment Service (span 5)
           → Stripe API (span 6)

  Propagate trace context: traceparent header (W3C standard)
```

### Alerting Rules
```
Alert on SYMPTOMS, not causes:
  ✅ "Error rate > 1% for 5 minutes" (symptom)
  ❌ "CPU > 80%" (cause — might be fine under load)

  ✅ "p99 latency > 2s for 5 minutes" (user-facing impact)
  ❌ "Database connections > 50" (might be normal)

  ✅ "Zero successful orders in 10 minutes" (business impact)
  ❌ "Disk usage > 90%" (might not matter for days)

Severity levels:
  Page (wake someone up): data loss, complete outage, security breach
  Ticket (fix during business hours): degraded performance, partial outage
  Log (investigate when convenient): unusual patterns, approaching limits
```

---

## 🚀 DEPLOYMENT — Zero Downtime

### Blue-Green Deployment
```
Blue (current) ← Load Balancer → serves traffic
Green (new)                    → idle, running new version

1. Deploy new version to Green
2. Run smoke tests against Green
3. Switch Load Balancer to Green
4. Green serves traffic, Blue becomes standby
5. If problems → switch back to Blue instantly
```

### Rolling Deployment
```
Pod 1 (v1) ✓   Pod 2 (v1) ✓   Pod 3 (v1) ✓
Pod 1 (v2) ↻   Pod 2 (v1) ✓   Pod 3 (v1) ✓  ← updating one at a time
Pod 1 (v2) ✓   Pod 2 (v2) ↻   Pod 3 (v1) ✓
Pod 1 (v2) ✓   Pod 2 (v2) ✓   Pod 3 (v2) ↻
Pod 1 (v2) ✓   Pod 2 (v2) ✓   Pod 3 (v2) ✓  ← done

Kubernetes:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # One extra pod during update
      maxUnavailable: 0  # Zero downtime
```

### Canary Deployment
```
Route 5% traffic to new version
Monitor error rate, latency
If OK → 25% → 50% → 100%
If bad → rollback instantly

Tools: Kubernetes + Istio, AWS App Mesh, Cloudflare Workers
```

### Health Checks
```
Liveness probe: "Is the process alive?" → restart if dead
  /healthz → 200 if process can respond

Readiness probe: "Can it serve traffic?" → remove from LB if not ready
  /readyz → 200 if DB connected, cache warm, dependencies reachable

Startup probe: "Has it finished booting?" → don't check liveness until ready
  /startupz → 200 when initialization complete
```

---

## References
- Load `references/scaling-patterns.md` for horizontal scaling, sharding, CQRS
- Load `references/message-queues.md` for Kafka/RabbitMQ/SQS patterns
- Load `references/docker-k8s.md` for containerization best practices
