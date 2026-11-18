# ToolNest AI Coding Agent Instructions

**Scope:** Applies to the entire repository. Read `docs/PROJECT_BLUEPRINT.md` and `docs/SECURITY.md` before changes to auth, file handling or infrastructure.

## Approved product rules
- Name: ToolNest. Light theme with blue accents. Account required for utility access.
- Web: Next.js App Router + TypeScript + Tailwind; server BFF uses secure Supabase sessions.
- Data: Supabase PostgreSQL, Row Level Security and private Storage.
- Heavy processing: Python worker, strict resource limits, private queue; no browser access to privileged keys.
- Twelve v1 utilities. Prefer browser-local processing for personal content.
- No OpenAPI contract, Swagger UI, OpenAPI generator or specification files.

## Required workflow
1. Inspect existing code and docs; don't silently replace decisions.
2. Choose the smallest coherent task with working vertical integration.
3. Specify trust boundaries and input/output formats before modifying server APIs.
4. Add validation, authorization, error handling and tests.
5. Run applicable typecheck, lint, tests, build; report exact commands and failures.
6. Update README and security checklist honestly. Do not claim a feature is finished without testing.
7. Never commit secrets; never install arbitrary code without review.

## Security non-negotiables
- `auth.getUser` must verify each protected server request; middleware is not authorization.
- Use RLS for user-owned tables. Check ownership in BFF operations using service role.
- Require same-origin checks for cookie-authenticated mutations; add explicit CSRF defenses if cross-site use evolves.
- All file objects private; randomized paths; upload size, signature and page limits; isolated workers.
- Never log uploaded content, signed URLs, access tokens or service keys.
- No shell commands constructed from input. No arbitrary network access from converters.
- Never deploy unisolated document converters for public anonymous traffic.

## Development conventions
- Strict TypeScript; function components; semantic HTML; accessible keyboard interactions.
- Use Next.js Route Handlers for public `/api/v1` endpoints.
- Python 3.11+ with typed functions where practical.
- Keep docs and tests close to behavior, not speculative promises.
- All files uploaded for server processing must expire and cleanup must be observed.

## Skills
Read the appropriate `.agents/skills/<name>/SKILL.md` when implementing: toolnest-development, frontend-development, backend-development, security-review, testing.
