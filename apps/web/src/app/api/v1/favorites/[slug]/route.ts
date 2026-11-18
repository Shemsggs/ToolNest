import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, sameOrigin } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { getTool } from '@/lib/tools';

const favoriteSchema = z.object({ favorite: z.boolean() }).strict();

export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await requireUser();
  if (!auth) return jsonError(401, 'UNAUTHENTICATED', 'Sign in');
  if (!await sameOrigin(request)) return jsonError(403, 'ORIGIN_DENIED', 'Invalid origin');
  const { slug } = await params;
  if (!getTool(slug)) return jsonError(404, 'TOOL_NOT_FOUND', 'Tool not found');
  const input = favoriteSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return jsonError(400, 'INVALID_FAVORITE', 'Choose whether to save this tool');

  const favorites = auth.client.from('favorites');
  const { error } = input.data.favorite
    ? await favorites.upsert({ user_id: auth.user.id, tool_slug: slug }, { ignoreDuplicates: true })
    : await favorites.delete().eq('user_id', auth.user.id).eq('tool_slug', slug);
  if (error) return jsonError(503, 'SAVE_FAILED', 'Could not update favorites');
  return NextResponse.json(input.data);
}
