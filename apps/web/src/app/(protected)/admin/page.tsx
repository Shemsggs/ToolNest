import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { adminClient } from '@/lib/supabase-admin';

export default async function Page() {
  const auth = await requireUser();
  if (!auth) redirect('/login');

  const { data: role, error: roleError } = await auth.client.from('admin_roles').select('role')
    .eq('user_id', auth.user.id).maybeSingle();
  if (roleError || !role || !['admin', 'security_admin'].includes(role.role)) notFound();

  const hasFactor = auth.user.factors?.some(factor => factor.status === 'verified');
  const { data: session } = await auth.client.auth.getClaims();
  if (!hasFactor || session?.claims.sub !== auth.user.id || session.claims.aal !== 'aal2') {
    return <main>
      <h1 className="text-3xl font-bold mb-4">Administration</h1>
      <p>Verify your authenticator in <Link className="text-blue-700 underline" href="/settings">Settings</Link> to continue.</p>
    </main>;
  }

  const admin = adminClient();

  const statuses = ['queued', 'processing', 'failed', 'completed'] as const;
  const recent = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const counts = await Promise.all(statuses.map(status => admin.from('processing_jobs')
    .select('id', { head: true, count: 'exact' }).eq('status', status).gte('created_at', recent)));

  return <main>
    <h1 className="text-3xl font-bold mb-4">Administration</h1>
    <h2 className="text-lg font-semibold mb-3">Server jobs created in the last 24 hours</h2>
    <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">{statuses.map((status, index) =>
      <div key={status} className="card">
        <dt className="capitalize text-sm text-slate-600">{status}</dt>
        <dd className="text-2xl font-semibold mt-1">{counts[index].error ? 'Unavailable' : counts[index].count ?? 0}</dd>
      </div>)}</dl>
  </main>;
}
