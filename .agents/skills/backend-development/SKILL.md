---
name: backend-development
description: Implement secure authenticated API routes, database migrations, and Python document workers.
---

# Backend Development

Verify current user with Supabase `auth.getUser()` for protected API requests. Check ownership independently before service-role operations. Use Zod input schemas, standard errors, rate quotas, private storage, and transitions that cannot be forged by a client. Worker jobs must be claimed atomically, leased, bounded, retried, and cleaned. Never process arbitrary user-supplied URLs/paths or execute shell input. Keep all admin credentials server-only. No Swagger/OpenAPI.
