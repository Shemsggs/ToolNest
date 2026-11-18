# Security readiness

Server processing is disabled by default. Keep it private until the public release checks below are complete.

## Trust boundaries and verification

| Boundary | Control | Verification |
| --- | --- | --- |
| Browser → BFF | Protected requests use `auth.getUser()`. Mutations check the origin and validate JSON. Admin reads require an assigned role, a verified factor, and AAL2 claims. Pending deletion blocks protected access. | Automated route tests cover unauthenticated reads, cross-origin requests, owner filtering, and the default server-processing setting. Live authentication, MFA, and browser checks are pending. |
| BFF → PostgreSQL | Owner RLS and explicit Data API grants restrict table access. Two-user isolation, service-only RPC grants, ordered file reservations, and the 20-job quota have database assertions. Job creation serializes by user. | The SQL assertions exercise PostgreSQL with minimal Supabase schema stubs and no default table grants. Live authorization and concurrent load tests are pending. |
| Browser → Storage | Private bucket with a 25 MiB PDF limit, randomized object paths, and scoped signed uploads. The BFF checks file size and MIME metadata before queueing. Downloads expire within five minutes or at result expiry, whichever comes first. | Live token expiry, replay, and Storage policies are pending. MIME metadata alone does not verify content. |
| Queue → worker | Expired leases are recovered. Processing checks and renews its lease between stages. Transient failures retry up to three total attempts. Cancellation and stale claims cannot publish results. Staged output metadata precedes upload and publication is atomic. | SQL assertions exercise expired leases and stale publication. Live worker crash and concurrent cancellation tests are pending. |
| PDF parser | The child receives no service credentials in its environment. It checks PDF headers, structure, encryption, page count, and output size. It has a 45-second timeout and Linux address-space, CPU, and file-size limits. | Subprocess tests cover valid and malformed PDFs, order, timeout handling, and the child environment. The Linux limits and OS-level isolation still need deployment testing. |
| Storage → cleanup → Auth | Expired file records are retained until Storage removal succeeds. Cleanup retries failures and reports counts and errors without logging file contents or signed links. Account deletion waits for expired uploads and tracked files before deleting the Auth user. | SQL assertions cover deletion eligibility. Scheduled cleanup, actual object removal, and Auth deletion are pending live verification. |
| Web responses | Baseline CSP restricts embedding, plugins, base URLs, and form targets. | Script and network directives still need a policy verified against Next.js and all browser tools. |

## Public release checks

- [ ] Run converters in OS-isolated, nonroot workloads with no outbound network or access to the queue process or its credentials. Enforce CPU, memory, disk and time budgets at the hosting layer. The current subprocess shares the worker's user and namespaces.
- [ ] Add constrained pre-queue content inspection and malware screening. Validate parser behavior against hostile PDFs and expansion limits.
- [ ] Add gateway/IP throttling and account rate limits for upload signing and other high-cost routes. Test concurrent quota enforcement and service saturation.
- [ ] Verify signed token replay and expiry, bucket visibility and maximum upload sizes against the actual Storage service.
- [ ] Schedule and monitor cleanup. Alert on retry backlogs and missed runs. Reconcile legacy untracked objects and exercise failed Storage removal and failed Auth deletion.
- [ ] Verify registration, recovery, MFA, account deletion, CSRF, and cross-tenant API and database access with two live accounts.
- [ ] Add production script/connect CSP, redacted security event monitoring, and automated dependency security updates.
- [ ] Complete browser accessibility and load testing, independent security review, and a backup restoration drill.
