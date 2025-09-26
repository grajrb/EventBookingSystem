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
* Auth (register/login/me)
* Event CRUD (admin)
* Booking create/cancel with slot updates
* Admin statistics
* WebSocket broadcast (can be asserted by connecting a client in tests)

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
- Helmet default headers (CSP can be layered later)
- Compression (gzip) for responses
- Strict body size limit (1MB JSON/forms)
- Configurable CORS via `ALLOWED_ORIGINS` (default `*` for dev)
- Granular rate limiting (global + auth + booking + admin)
- Audit logs for critical mutations (users, events, bookings, notifications)

Planned / Recommended Enhancements:
- Add Content Security Policy tailored to deployed asset domains
- Replace wildcard origins in production with explicit domains
- Add DB-level transactional fallback for slot decrement if Redis unavailable
- Introduce structured logging (JSON) for easier ingestion into monitoring stack
- Implement refresh token rotation & shorter-lived access tokens

---

## Concurrency Note

Slot availability primarily enforced atomically through Redis. If Redis is unavailable, the fallback path reduces concurrency guarantees; for mission-critical deployments, add a database-side conditional update (e.g., `UPDATE events SET available_slots = available_slots - 1 WHERE id=? AND available_slots > 0`) within a transaction and verify affected row count.
