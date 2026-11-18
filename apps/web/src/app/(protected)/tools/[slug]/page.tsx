import { notFound, redirect } from 'next/navigation';
import { getTool } from '@/lib/tools';
import { requireUser } from '@/lib/auth';
import { serverProcessingEnabled } from '@/lib/config';
import { ToolRunner } from '@/components/tool-runner';
import { ServerMerge } from '@/components/server-merge';
import { FavoriteButton } from '@/components/favorite-button';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getTool(slug)) notFound();
  const auth = await requireUser();
  if (!auth) redirect('/login');
  const { data, error } = await auth.client.from('favorites').select('tool_slug')
    .eq('user_id', auth.user.id).eq('tool_slug', slug).maybeSingle();

  return <main>
    {error ? <p className="mb-4 text-sm">Favorites are temporarily unavailable.</p>
      : <FavoriteButton key={slug} slug={slug} initialFavorite={Boolean(data)} />}
    <ToolRunner slug={slug} />
    {slug === 'merge-pdf' && serverProcessingEnabled() && <ServerMerge />}
  </main>;
}
