# ToolNest API

`/api/v1` uses JSON. Protected endpoints require a valid ToolNest session. Mutations require an `Origin` header matching the request origin. Errors use `{ "error": { "code": "…", "message": "…", "requestId": "…" } }`.

## Jobs

| Method and path | Request | Response |
| --- | --- | --- |
| `GET /api/v1/jobs` | No body | `{ jobs }` with up to 30 recent jobs |
| `POST /api/v1/jobs` | `{ tool: "merge-pdf", files: [{ name, sizeBytes, contentType: "application/pdf" }, …] }` | `201` with `{ jobId, status }`. There must be 2–10 nonempty PDFs of at most 25 MiB each. The per-account limit is 20 jobs in 24 hours. |
| `GET /api/v1/jobs/:id` | Job UUID | `{ job }` with status, timestamps, count and error code |
| `POST /api/v1/jobs/:id/uploads` | `{ position, filename, sizeBytes, contentType: "application/pdf" }`. Use the zero-based file position from job creation. | `{ fileId, path, token }`. Send the file to Supabase Storage using the signed upload token. |
| `POST /api/v1/jobs/:id/submit` | No body | `{ jobId, status }` after metadata verification. A retry may return the current queued, processing or completed status. |
| `DELETE /api/v1/jobs/:id` | No body | `{ jobId, status: "cancelled" }` for an active job |
| `GET /api/v1/jobs/:id/download` | Job UUID | `{ url, expiresInSeconds }` for a completed, unexpired result |

Job reads are owner-scoped. The service role writes the queue and signs URLs after ownership checks. Signed credentials are scoped to one object. The browser sends only metadata to the Next.js API. The worker reads the private files from Supabase and publishes a result only while it holds the active lease.

## Account

| Method and path | Request | Response |
| --- | --- | --- |
| `PUT /api/v1/favorites/:slug` | `{ favorite: boolean }`, with a recognized tool slug | `{ favorite }` |
| `PATCH /api/v1/settings` | `{ displayName }`, up to 100 characters after trimming. An empty value clears the name. | `{ displayName }` |
| `PATCH /api/v1/settings/password` | `{ password }`, at least 8 characters and at most 72 UTF-8 bytes | `{ updated: true }`. Accounts with a verified factor require a verified MFA session. |
| `DELETE /api/v1/settings/account` | `{ password, confirmation: "DELETE" }`. Requires the current password and verified MFA if enrolled. | `202` with `{ status: "scheduled" }`. The cleanup process finalizes deletion after temporary file cleanup. |
