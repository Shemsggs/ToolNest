import { redirect } from 'next/navigation';
import { ToolGrid } from '@/components/tool-grid';
import { requireUser } from '@/lib/auth';

export default async function Page() {
  const auth = await requireUser();
  if (!auth) redirect('/login');
  const { data } = await auth.client.from('profiles').select('display_name').eq('id', auth.user.id).maybeSingle();

  return <main>
    <h1 className="text-3xl font-bold break-words">{data?.display_name ? `Welcome, ${data.display_name}` : 'Welcome to ToolNest'}</h1>
    <p className="text-slate-600 mt-2 mb-8">Choose a tool to process files or text in your browser.</p>
    <ToolGrid />
  </main>;
}
