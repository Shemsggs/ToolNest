# ✦ ToolNest

Account-only utility workspace built with Next.js, Supabase, and Python. The twelve browser tools run locally. Server PDF merge is an opt-in feature for private development and staging.

## What's included
- Next.js App Router and Tailwind, with registration, sign-in, password recovery, and a protected dashboard.
- **12 browser-based tools**: four PDF, four image, QR code, JSON, Base64, and text case.
- Saved favorites, display names, authenticator enrollment and verification, and scheduled account deletion.
- Experimental **server PDF merge** with private uploads, a leased PostgreSQL queue, cancellation and retries, signed result downloads, and job history.
- Read-only administration with job counts. An operator assigns an `admin` or `security_admin` role in `public.admin_roles`. Access requires a verified MFA session.
- `AGENTS.md` and five `.agents/skills/**/SKILL.md` agent instructions.
- No OpenAPI or Swagger.

## Quick start (local development)

Requirements: Node.js 20+, pnpm 9+, Python 3.11+, and Supabase CLI v3. Docker is required for a local Supabase stack. On Windows use PowerShell and Docker Desktop for local Supabase.

1. `corepack enable` and `corepack prepare pnpm@9.15.9 --activate`
2. `pnpm install --frozen-lockfile`
3. `supabase start` (requires Supabase CLI; run in repo root)
4. Apply all migrations with `supabase migration up`. Use `supabase db reset` for a disposable local database only.
5. `cp .env.example apps/web/.env.local` and populate actual public and service keys from `supabase status` (on Windows copy manually).
6. `pnpm dev`; open http://localhost:3000
7. Use the local Supabase test inbox to verify signup and password recovery. Open recovery links in the browser that requested them.

For a hosted database, use `supabase login`, `supabase link --project-ref YOUR_PROJECT_REF`, and `supabase db push --remote` from the repo root instead of starting the local stack. The migrations include ToolNest's Data API grants. Configure the hosted project URL and keys in `apps/web/.env.local`, then allow both `/auth/callback` and `/auth/callback?flow=recovery` on your application origin. [Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations) · [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)

### Python worker

```bash
cd services/processor
python -m venv .venv
# activate the environment for your OS
pip install -e '.[test]'
# Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in this shell
python -m app.worker
```

Run `python -m app.cleanup` from the same environment about every ten minutes. Monitor successful runs, nonzero exit codes and the age of expired rows. This command handles both temporary files and account deletion, so schedule it even when server merge is disabled. Run one cleanup instance at a time. A deletion request signs the user out, cancels active jobs, and waits for the upload-token window and tracked files to clear before permanently deleting the Auth user and its cascading records.

To test server PDF merge in a private environment, set `TOOLNEST_SERVER_PROCESSING_ENABLED=true` in `apps/web/.env.local` and start the worker. The default is disabled. Signed upload tokens expire after two hours. To allow them to lapse before removing inputs, the application keeps input reservations until 125 minutes after the one-hour upload window. Published outputs expire an hour after completion. [Supabase signed uploads](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl)

**Important:** The local Docker/Supabase environment must expose the worker-accessible URL. Container-to-host `127.0.0.1` is not equivalent to host-to-host. Use explicit network configuration for deployments.

### Build and validation

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
node apps/web/scripts/smoke.mjs
```

Run `python -m pytest` in `services/processor` after installing the test extra. Run `psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/job_lifecycle.sql` from the repo root against an empty, disposable database with the migrations applied. The SQL checks quotas, lease recovery, result publication, deletion eligibility, and two-account database isolation.

## Current limits
- Client and server API flows require a configured Supabase instance. No credentials are bundled.
- The Python server path supports PDF merge. All twelve tools also run locally in the browser.
- The API checks object metadata before queuing. The worker checks content and page limits in a subprocess. Public release still requires OS-level converter isolation, malware screening, gateway rate limits, and live security verification.
- Cleanup scheduling, monitoring, browser end-to-end tests, and external security and load tests need a running deployment environment.
- Browser utilities are prototypes and may encounter large-file or unsupported-PDF limitations.

**Keep server processing private until the security release checks are complete.**

## Privacy
Browser tools process user files locally. The experimental server PDF merge uploads to private temporary storage. Complete cleanup and deletion monitoring are mandatory before production.

## Reference docs
- `docs/PROJECT_BLUEPRINT.md` — architecture and implementation decisions.
- `docs/SECURITY.md` — missing controls and release gates.
- `docs/API.md` — account and server job endpoints.
- `AGENTS.md` — coding-agent working agreement.
