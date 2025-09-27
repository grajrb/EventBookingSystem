# Event Booking System

A full-stack application for browsing and booking event slots, with real-time availability updates.

[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-blue?style=for-the-badge&logo=github)](https://github.com/grajrb/EventBookingSystem)

## Repository

- **GitHub**: [grajrb/EventBookingSystem](https://github.com/grajrb/EventBookingSystem)
- **Last Updated**: June 18, 2025
- **License**: [MIT](LICENSE)

## Features

- User authentication (signup/login)
- Event browsing with search and pagination
- Event booking with real-time slot availability
- Admin dashboard for event management
- User dashboard to view bookings
- CSV export for booking data
- Real-time slot availability updates via WebSockets
- Comprehensive Redis caching for improved performance
- Secure image handling (http/https URLs or validated base64 data URIs)
- Security hardening: helmet headers, compression, granular rate limiting, configurable CORS origins
- Content Security Policy (baseline) with configurable extra origins (`CSP_EXTRA_ORIGINS`)
- Prometheus metrics endpoint `/metrics` (counters & histograms)
- Structured logging (pino) for production observability
- Refresh token rotation (short-lived access token + persisted refresh tokens)

## Tech Stack

- **Frontend**: React.js with TailwindCSS and Radix UI
- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL
- **Caching**: Redis
- **ORM**: Drizzle ORM
- **Authentication**: JWT-based
- **Real-time**: WebSockets

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- Redis server

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/grajrb/EventBookingSystem.git
   cd EventBookingSystem
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Fill in your database and Redis connection details

4. Initialize the database:
   ```
   npm run db:push
   ```

5. Start the development server:
   ```
   npm run dev
   ```

The Vite dev client will be available at http://localhost:5173 (default) proxied API at http://localhost:5000 (server). All traffic including WebSocket (path `/ws`) is served via port 5000 when using the integrated dev script.

### Dev Scripts

```bash
npm run dev          # Starts server only (Express + Vite middleware)
npm run dev:server   # Nodemon watch server/shared changes
npm run dev:full     # Nodemon watch server + client source, restarts as needed
```

## Environment Variables

Required (recommended) variables in `.env`:

```env
DATABASE_URL=postgres://user:pass@host:5432/dbname
JWT_SECRET=your_long_random_jwt_secret_value_at_least_32_chars
REDIS_URL=redis://localhost:6379
NODE_ENV=development
DB_SSL=false                # set true if your managed Postgres requires SSL
MOCK_DB=false               # when true (or dev) login with test@example.com/password works without DB
PORT=5000                   # server listen port
ALLOWED_ORIGINS=*           # comma separated list, * for all (prod: set specific hosts)
CSP_EXTRA_ORIGINS=          # optional additional origins for script/style/connect-src
```

## Production Build & Deployment

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run database migrations:
   ```bash
   npm run db:push
   ```
3. Build client + bundle server:
   ```bash
   npm run build
   ```
4. Start:
   ```bash
   npm start
   ```

The server now serves:
* API under `/api/*`
* Static SPA from `client/dist` with an Express fallback for deep links
* WebSocket endpoint at `/ws`
* Health endpoints: `/healthz` (liveness) and `/readyz` (readiness)

### Fly.io (Single Runtime) Deployment

This repo includes a `Dockerfile` and `fly.toml` for quick deployment to Fly.io using a single container that serves both API + static client + WebSockets.

#### 1. Prerequisites

- Fly CLI installed: <https://fly.io/docs/hands-on/install-flyctl/>
- Accounts on:
      - Fly.io (app runtime)
      - Neon.tech (Postgres) or alternative managed Postgres
      - Upstash (Redis) or alternative managed Redis (optional but recommended)

#### 2. Create External Services

1. Create a Neon Postgres project & database.
2. Copy the connection string (e.g. `postgresql://user:pass@ep-xxxx-pooler.us-east-2.aws.neon.tech/db?sslmode=require`). Use `sslmode=require`.
3. Create an Upstash Redis database; copy the rediss URL (TLS) or redis URL.

#### 3. (Optional) Run Local Build Test

```bash
docker build -t eventapp .
docker run --rm -p 5000:5000 -e PORT=5000 eventapp
```

Visit <http://localhost:5000> and ensure `/healthz` returns 200.

#### 4. Configure Fly App

```bash
fly launch --no-deploy
# If prompted for builder, choose existing Dockerfile.
```

If you already created `fly.toml` (present in repo), ensure the `app` name inside is globally unique. If not, edit it before deploying.

#### 5. Set Secrets

Generate strong secrets (≥ 32 chars) for JWT & refresh tokens.

```bash
fly secrets set \
   JWT_SECRET="<long-random>" \
   REFRESH_TOKEN_SECRET="<long-random>" \
   DATABASE_URL="<neon-connection-string>" \
   REDIS_URL="<upstash-redis-url>" \
   ALLOWED_ORIGINS="https://<your-app>.fly.dev" \
   CSP_EXTRA_ORIGINS="" \
   DB_SSL=true
```

Add any other tunables as needed (e.g., rate limit overrides).

#### 6. Deploy

```bash
fly deploy
```

After the first deploy Fly assigns a free TLS domain: `https://<app-name>.fly.dev`.

#### 7. Database Migrations

If using Drizzle push:

```bash
fly ssh console -C "cd /workspace && npm run db:push"
```

Alternatively, integrate a release command (commented in `fly.toml`). For production consider schema migrations via migration files rather than push.

#### 8. Scaling & Resources

Start small (shared-cpu-1x):

```bash
fly scale vm shared-cpu-1x --memory 256
```

Add regions later:

```bash
fly regions add fra lhr
```

Ensure Redis latency remains low relative to app region.

#### 9. Logs & Metrics

```bash
fly logs
```

Metrics exposed at `https://<app>.fly.dev/metrics` (protect via token or private scraping in production—Fly private networking or an auth middleware tweak).

#### 10. Custom Domain (Optional)

Add a domain:

```bash
fly certs create app.example.com
```

Then set the DNS CNAME/A per Fly instructions. TLS handled automatically.

#### 11. Health Checks

Fly uses `/healthz`; ensure it returns 200. If you add readiness logic, you can expose `/readyz` and update `fly.toml` accordingly.

#### 12. Zero-Downtime Migrations (Future)

If you introduce breaking DDL changes, add a `release_command` in `fly.toml` to run migrations before new machines start serving traffic.

#### 13. Refresh Token Table Reminder

Ensure the refresh token table/schema exists and migrations have run before enabling clients to refresh. If absent, add table definition to `shared/schema.ts` and run push/migrate prior to production traffic.

---

### Container / Reverse Proxy Notes
If using Nginx or another proxy, be sure to forward WebSocket upgrades for path `/ws`.

Example Nginx snippet:

```nginx
location /ws {
   proxy_pass http://app:5000/ws;
   proxy_http_version 1.1;
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection "upgrade";
   proxy_set_header Host $host;
}
```

## Testing

Jest + Supertest integration tests (initial scaffold) live in `tests/integration`.

Run:

```bash
npm test
```

Planned future coverage:

- Auth (register/login/me)
- Event CRUD (admin)
- Booking create/cancel with slot updates
- Admin statistics
- WebSocket broadcast (can be asserted by connecting a client in tests)

## Deployment Checklist

- Set all required env vars (DATABASE_URL, JWT_SECRET, REDIS_URL if using Redis)
- Ensure database reachable & migrations applied (`npm run db:push`)
- (Optional) Redis reachable for caching/slot concurrency (falls back to direct DB access if not)
- Build artifacts present (`client/dist` + `dist/index.js`)
- Reverse proxy passes through `/api`, `/ws`, and serves other paths to the Node app (or serve static directly with fallback kept)
- Monitor `/healthz` and `/readyz` for platform health checks
- Configure log drain or persist stdout

## Scaling Notes

## Admin Promotion

Two methods to grant admin rights:

1. API (existing admin required):
   `POST /api/admin/users/:id/promote` with Authorization bearer token of an admin user.
2. Script (direct DB update):

   ```bash
   npx tsx scripts/promote-user.ts user@example.com
   ```

## Event Images

Event creation/edit form supports an Image field. You may supply:

1. A standard http/https image URL (JPG, PNG, GIF, WebP, AVIF, etc.)
2. A base64 data URI of the form: `data:image/(png|jpeg|jpg|gif|webp|avif);base64,<data>`

Validation & limits:

- Data URI max length ~2,000,000 characters (~1.5MB). Longer strings are rejected.
- Only listed mime subtypes accepted.
- http/https URLs are fetched through `/api/image-proxy` with size & content-type validation.
- Server re-sanitizes input; invalid values are rejected with a validation error.

Example update:

```http
PUT /api/events/:id
{
   "image": "https://cdn.example.com/banner.jpg"
}
```

Other updatable fields: title, description, location, date, totalSlots, tags.

## User Management

Admin dashboard now displays a Users section:

- List all users (`GET /api/admin/users`)
- Promote a user to admin (`POST /api/admin/users/:id/promote`)

Promotion is idempotent (promoting an already-admin user returns a success message without change).

Scaling considerations:

- Horizontal scaling requires a shared Redis for booking slot atomicity & cache coherence.
- WebSocket scaling uses Redis pub/sub for fan-out across instances.
- Stateless JWT auth (sessions not stored server-side) allows simple scaling.
- Database connection pool sizing should be tuned per instance count.

## Partial Event Updates (PATCH)

Admins can partially update events without sending the full payload:

```http
PATCH /api/events/:id
{
   "title": "New Title",
   "image": "https://cdn.example.com/new.jpg"
}
```

Notes:

- Same validation as full PUT but only provided fields applied.
- Slot changes invalidate caches and re-broadcast updates.

## Rate Limiting

Multiple layers of rate limiting reduce abuse:

| Scope | Limit | Window |
|-------|-------|--------|
| All /api routes (baseLimiter) | 100 req/IP | 15 min |
| Auth routes (/api/auth/*) | 10 req/IP | 1 hr |
| Booking routes (POST/DELETE /api/events/:id/book) | 50 req/IP | 1 hr |
| Admin promote user | 20 req/IP | 15 min |

When exceeded, HTTP 429 with JSON message is returned. Adjust thresholds in `server/middleware/rateLimit.ts`.

## Multi-Instance WebSocket Scaling

All instances sharing the same `REDIS_URL` will:

- Broadcast locally to connected clients.
- Publish the message to channel `ws:broadcast`.
- Other instances receive and re-broadcast locally only (no republish loop).

No additional configuration needed beyond setting identical `REDIS_URL` on each instance.

## API Documentation

For detailed API documentation, including:

- Authentication endpoints
- Event management endpoints
- Booking operations
- Admin functionalities
- WebSocket events
- Error handling
- Rate limiting

👉 Please refer to our comprehensive [API Documentation](docs/API.md).

## License

This project is licensed under the [MIT License](LICENSE). See the [LICENSE](LICENSE) file for details.

## Created By

Gaurav Raj

---

## Security Hardening Summary

Implemented:

- Mandatory strong JWT secret (startup fails if missing or <32 chars)
- Helmet default headers (baseline CSP enabled)
- Baseline Content Security Policy (script/style self + optional extras; img allows data: for embedded images)
- Compression (gzip) for responses
- Strict body size limit (1MB JSON/forms)
- Configurable CORS via `ALLOWED_ORIGINS` (default `*` for dev)
- Granular rate limiting (global + auth + booking + admin)
- Audit logs for critical mutations (users, events, bookings, notifications)

Planned / Recommended Enhancements:

- Tailor CSP to deployed asset domains (remove 'unsafe-inline' when feasible)
- Replace wildcard origins in production with explicit domains
- Further tighten CSP (hash or nonce scripts, disallow inline styles)
- Add structured JSON log shipping (e.g., to ELK / Loki) if not handled by platform
- Shorter-lived access tokens (<1h) plus silent refresh

---

## Concurrency Note

Slot availability primarily enforced atomically through Redis. If Redis is unavailable, the fallback path reduces concurrency guarantees; for mission-critical deployments, add a database-side conditional update (e.g., `UPDATE events SET available_slots = available_slots - 1 WHERE id=? AND available_slots > 0`) within a transaction and verify affected row count.
Implemented: A DB conditional decrement fallback now runs automatically when Redis is unavailable (atomic single-row update). Redis path still preferred for performance.

## Metrics

The application exposes Prometheus metrics at `/metrics` including:

- `eventapp_http_requests_total{method,route,status}`
- `eventapp_http_request_duration_seconds` (histogram)
- `eventapp_bookings_total`
- Default process/runtime metrics (prefixed `eventapp_`)

Scrape example (Prometheus):

```yaml
scrape_configs:
   - job_name: 'eventapp'
      static_configs:
         - targets: ['app:5000']
```

## Auth Tokens

Access tokens (JWT) expire in 7d. A refresh token (stored server-side) enables rotation:

1. Client stores refresh token securely (HTTP-only cookie recommended in production; currently JSON response).
2. To refresh: `POST /api/auth/refresh { "refreshToken": "..." }` returns new access + rotated refresh token.
3. Stolen refresh tokens are invalidated upon first use (rotation deletion before re-issuing new token).

Future enhancements: Device tracking, refresh token revocation list, shorter access token lifetime (<1h) with auto silent refresh.

## Fly Domain & TLS

Fly automatically provisions a TLS certificate for `<app-name>.fly.dev`. You can map a custom domain at any time (see section above) without code changes; environment `ALLOWED_ORIGINS` and `CSP_EXTRA_ORIGINS` should then include that domain.
