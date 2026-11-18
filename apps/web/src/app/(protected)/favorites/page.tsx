import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ToolGrid } from '@/components/tool-grid';
import { requireUser } from '@/lib/auth';
import { TOOLS } from '@/lib/tools';

export default async function Page() {
  const auth = await requireUser();
  if (!auth) redirect('/login');
  const { data, error } = await auth.client.from('favorites').select('tool_slug').eq('user_id', auth.user.id);
  const slugs = new Set(data?.map(favorite => favorite.tool_slug));
  const tools = TOOLS.filter(tool => slugs.has(tool.slug));

  return <main>
    <h1 className="text-3xl font-bold mb-6">Favorites</h1>
    {error ? <p>Could not load favorites.</p> : tools.length ? <ToolGrid tools={tools} />
      : <p className="text-slate-600">Save favorites from any tool page. <Link href="/tools" className="text-blue-700 underline">Browse tools</Link></p>}
  </main>;
}
