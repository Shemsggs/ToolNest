import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, sameOrigin } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { serverEnv } from '@/lib/config';
import { adminClient } from '@/lib/supabase-admin';

const deletionSchema = z.object({ password: z.string().min(1).max(1024), confirmation: z.literal('DELETE') }).strict();

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (!auth) return jsonError(401, 'UNAUTHENTICATED', 'Sign in');
  if (!await sameOrigin(request)) return jsonError(403, 'ORIGIN_DENIED', 'Invalid origin');
  const input = deletionSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return jsonError(400, 'INVALID_CONFIRMATION', 'Enter your password and type DELETE');
  if (!auth.user.email) return jsonError(400, 'ACCOUNT_UNAVAILABLE', 'This account cannot be verified by email and password');

  const { data: claims, error: claimsError } = await auth.client.auth.getClaims();
  if (claimsError || claims?.claims.sub !== auth.user.id) return jsonError(503, 'SESSION_UNAVAILABLE', 'Could not verify your session');
  if (auth.user.factors?.some(factor => factor.status === 'verified') && claims.claims.aal !== 'aal2') {
    return jsonError(403, 'MFA_REQUIRED', 'Verify a code in Settings before deleting your account');
  }

  const { url, key } = serverEnv();
  const verifier = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await verifier.auth.signInWithPassword({ email: auth.user.email, password: input.data.password });
  if (error || data.user?.id !== auth.user.id) return jsonError(403, 'PASSWORD_MISMATCH', 'Could not verify your current password');
  await verifier.auth.signOut({ scope: 'local' });

  const { error: deletionError } = await adminClient().rpc('request_toolnest_account_deletion', { p_user_id: auth.user.id });
  if (deletionError) return jsonError(503, 'DELETE_FAILED', 'Could not schedule account deletion');
  await auth.client.auth.signOut({ scope: 'global' });
  return NextResponse.json({ status: 'scheduled' }, { status: 202 });
}
