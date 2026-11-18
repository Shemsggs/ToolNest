import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, sameOrigin } from '@/lib/api';
import { requireUser } from '@/lib/auth';

const passwordSchema = z.object({ password: z.string().min(8).max(72)
  .refine(value => new TextEncoder().encode(value).length <= 72) }).strict();

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (!auth) return jsonError(401, 'UNAUTHENTICATED', 'Your session expired. Request another reset link.');
  if (!await sameOrigin(request)) return jsonError(403, 'ORIGIN_DENIED', 'Invalid origin');
  const input = passwordSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return jsonError(400, 'INVALID_PASSWORD', 'Use at least 8 characters and at most 72 UTF-8 bytes');

  if (auth.user.factors?.some(factor => factor.status === 'verified')) {
    const { data } = await auth.client.auth.getClaims();
    if (data?.claims.sub !== auth.user.id || data.claims.aal !== 'aal2') {
      return jsonError(403, 'MFA_REQUIRED', 'Verify your authenticator in Settings before changing your password');
    }
  }

  const { error } = await auth.client.auth.updateUser({ password: input.data.password });
  if (error) return jsonError(400, 'PASSWORD_UPDATE_FAILED', 'Could not update password. Choose a different password or request another reset link.');
  return NextResponse.json({ updated: true });
}
