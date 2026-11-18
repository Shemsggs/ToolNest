import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { jobSummaryFields } from '@/lib/api';
import { getTool } from '@/lib/tools';
import { JobActions } from '@/components/job-actions';

export default async function Page() {
  const auth = await requireUser();
  if (!auth) redirect('/login');
  const { data, error } = await auth.client.from('processing_jobs').select(jobSummaryFields)
    .eq('user_id', auth.user.id).order('created_at', { ascending: false }).limit(30);
  const now = Date.now();

  return <main>
    <h1 className="text-3xl font-bold mb-5">Server job history</h1>
    {error ? <p>Could not load jobs.</p> : !data?.length
      ? <p className="text-slate-600">No server jobs yet. <Link href="/tools/merge-pdf" className="text-blue-700 underline">Open Merge PDF</Link></p>
      : <ul className="space-y-3">{data.map(job => {
        const expired = Date.parse(job.expires_at) <= now;
        const status = expired && !['failed', 'cancelled'].includes(job.status) ? 'expired' : job.status;
        return <li key={job.id} className="card flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">{getTool(job.tool_slug)?.title ?? job.tool_slug}</h2>
            <p className="text-sm capitalize text-slate-600">{status}</p>
            <time className="text-xs text-slate-600" dateTime={job.created_at}>{new Date(job.created_at).toLocaleString('en', { timeZone: 'UTC', timeZoneName: 'short' })}</time>
          </div>
          <JobActions id={job.id} status={status} />
        </li>;
      })}</ul>}
  </main>;
}
