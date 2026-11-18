import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, sameOrigin } from '@/lib/api';
import { requireUser } from '@/lib/auth';

const settingsSchema = z.object({ displayName: z.string().trim().max(100) }).strict();

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (!auth) return jsonError(401, 'UNAUTHENTICATED', 'Sign in');
  if (!await sameOrigin(request)) return jsonError(403, 'ORIGIN_DENIED', 'Invalid origin');
  const input = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return jsonError(400, 'INVALID_SETTINGS', 'Use a display name of up to 100 characters');

  const { data, error } = await auth.client.from('profiles').update({ display_name: input.data.displayName || null })
    .eq('id', auth.user.id).select('display_name').single();
  if (error) return jsonError(503, 'SAVE_FAILED', 'Could not save profile');
  return NextResponse.json({ displayName: data.display_name ?? '' });
}
