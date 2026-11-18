# ToolNest architecture — approved direction

## Decisions
- Project: ToolNest, account-required online utility platform.
- UI: white/blue light theme; mobile-first, accessible and responsive.
- Stack: Next.js, React, TypeScript, Tailwind, Supabase Auth/Postgres/Storage, Python worker, container hosting.
- Twelve tools: merge/split/rotate/extract PDF; resize/convert/compress/crop image; QR; JSON; Base64; text case.
- Browser-local by default. Server processing for heavier authenticated PDF jobs. No OpenAPI or Swagger.
- Main client is deployed to Vercel. Worker is deployed to separately isolated hosting. Use versioned, manually documented `/api/v1` JSON endpoints.

## API routes
- `GET/POST /api/v1/jobs` — list/create server jobs
- `POST /api/v1/jobs/:id/uploads` — get signed upload token
- `POST /api/v1/jobs/:id/submit` — verify inputs and queue
- `GET /api/v1/jobs/:id` — status
- `DELETE /api/v1/jobs/:id` — cancel active job
- `GET /api/v1/jobs/:id/download` — signed result download

Profile settings, password changes, favorites, and account deletion have protected endpoints. The admin job summary is server-rendered and requires an admin role and MFA. See `docs/API.md` for request and response formats.

## Database tables
profiles, user_settings, tools, favorites, processing_jobs, job_files, usage_events, admin_roles, audit_logs, account_deletion_requests. RLS is owner-based. Only the BFF and worker can write job and file state.

## Data flow
Authenticated browser → Next.js BFF → private upload tokens → private Storage → database queue → isolated Python worker → private result → short-lived signed download → cleanup.

## MVP delivery order
1. Monorepo, local Supabase, identity + RLS, dashboard.
2. Browser utilities with independent validations and tests.
3. Server PDF merge vertical slice, job lifecycle and private storage.
4. Production hardening: isolated workloads, timeouts, retries, rate limiting, CSRF, auditing, object lifecycle and monitoring.
5. Add profile/settings/favorites, email recovery, admin, load tests, accessibility checks and staged deployment.

## Security release requirement
Server processing defaults to disabled and may be enabled in private development or staging. Public uploads require the controls and verification in `docs/SECURITY.md`.
