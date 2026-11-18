---
name: security-review
description: Review ToolNest auth, RLS, uploads, processing isolation, and data retention before release.
---

# Security Review

Threat-model the browser, API BFF, Supabase RLS/storage, queue, and worker. Try cross-user IDOR, malicious PDF payloads, MIME spoofing, decompression bombs, oversized inputs, CSRF, XSS, credential leaks, quota races, token reuse, expired links, failed cleanup, and worker crashes. High severity issues block release. Check secrets never reach client code or logs. Document each security assertion as verified, unverified, or missing in `docs/SECURITY.md`. Never conceal limitations.
