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

1. Install dependencies:

```bash
npm install
```

1. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Fill in your database and Redis connection details

1. Initialize the database:

```bash
npm run db:push
```

1. Start the development server:

```bash
npm run dev
```

The Vite dev client will be available at <http://localhost:5173> (default) and the API at <http://localhost:5000>. All traffic including WebSocket (path `/ws`) is served via port 5000 when using the integrated dev script.

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

- API under `/api/*`
- Static SPA from `client/dist` with an Express fallback for deep links
- WebSocket endpoint at `/ws`
- Health endpoints: `/healthz` (liveness) and `/readyz` (readiness)

### Account Settings Enhancements

The profile page now includes:

- Profile update (name, bio, avatar URL, JSON preferences)
- Change password (current + new password validation)
- Account deletion (with safeguard to prevent deleting the last admin)

API endpoints:

```http
PUT    /api/profile               # Update profile fields
POST   /api/profile/password      # Change password
DELETE /api/profile               # Delete own account (cannot remove last admin)
```

Errors surface through the unified ApiError toast system. Deleting an account revokes refresh tokens (best-effort) and logs out the user client-side.

### Render Deployment (Single Service)

Deploy this application to Render as a single Web Service serving API + static client.

#### 1. External Services

Provision (or reuse):

- Neon (or other managed Postgres) – obtain connection string with `sslmode=require` if needed.
- Upstash Redis (or any managed Redis) for caching + slot concurrency (optional but recommended; app will fallback without Redis with reduced concurrency guarantees).

#### 2. Repository & Build

Push your code to GitHub (public or private with Render authorized).

Render Web Service settings:

- Environment: Node
- Build Command:

```bash
npm install && npm run build
```

- Start Command:

```bash
npm start
```

- Root Directory: repository root (where `package.json` lives)

The build script compiles client (Vite) + bundles server (esbuild) into `dist/` and `client/dist/`.

#### 3. Environment Variables (Render Dashboard)

| Variable | Description |
|----------|-------------|
| NODE_ENV | production |
| PORT | Render sets `$PORT`; server uses `process.env.PORT \|\| 5000` |
| DATABASE_URL | Postgres connection string |
| DB_SSL | true if provider requires SSL (Neon yes) |
| REDIS_URL | Redis endpoint (if using) |
| JWT_SECRET | ≥32 char random secret |
| REFRESH_TOKEN_SECRET | Separate ≥32 char random secret |
| ALLOWED_ORIGINS | Your Render domain (e.g. `https://your-app.onrender.com`) |
| CSP_EXTRA_ORIGINS | Additional origins for CSP if needed |

#### 4. First Deploy

Render will detect changes and build automatically on creation. Watch build logs until it starts listening. After deployment, visit:

```text
https://<your-app>.onrender.com/healthz
```
Expect JSON `{"status":"ok"}`.

#### 5. Database Schema

If the database is empty (first deploy), run a one-off shell in Render or locally with the same DATABASE_URL:

```bash
npm run db:push
```
(Render: use the Shell tab if available, or temporarily add a build step; long-term prefer migration files.)

#### 6. Static Assets & SPA

The server serves `client/dist` directly in production. No extra CDN required initially. Add a CDN later if needed by placing it in front of the Render service.

#### 7. Logging & Metrics

View structured logs in Render dashboard. Prometheus metrics are at `/metrics`; to restrict access, add an auth layer or IP filtering at a proxy/CDN.

#### 8. Scaling & Performance

- Start with the free instance tier (auto-sleeps). For always-on, upgrade plan.
- If memory pressure occurs, optimize dependencies or upgrade instance size.
- Redis strongly recommended before adding multiple instances.

#### 9. Custom Domain

Add your domain in Render settings; update `ALLOWED_ORIGINS` and optionally `CSP_EXTRA_ORIGINS` to include it.

#### 10. Refresh Token Table Reminder

Ensure refresh token table exists in `shared/schema.ts` (if you added it) and that `db:push` has applied it. Without it, refresh flow will fail.

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

### Keep-Alive (Cold Start Mitigation)

Because free tiers may spin down after inactivity, a GitHub Actions workflow (`.github/workflows/keepalive.yml`) is included to ping the application every 10 minutes with a small random jitter. This helps reduce cold start latency but has important caveats:

- Respect provider Terms of Service; excessive artificial traffic can violate policies.
- It does not guarantee zero cold starts (provider may still recycle the instance).
- Disable or adjust the schedule if you upgrade to an always-on plan.
- If you use a separate frontend domain later, you can add additional curl steps there.

To disable: delete the workflow file or comment out the `schedule` section.

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

