import { getSupabaseServer } from './supabase-server';
import { cache } from 'react';

export const requireUser = cache(async () => {
  const client = await getSupabaseServer();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;

  const { data: deletion, error: deletionError } = await client.from('account_deletion_requests')
    .select('user_id').eq('user_id', user.id).maybeSingle();
  if (deletionError || deletion) return null;
  return { client, user };
});
