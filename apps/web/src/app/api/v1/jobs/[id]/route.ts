import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { jobIdSchema, jobSummaryFields, jsonError, sameOrigin } from '@/lib/api';
import { adminClient } from '@/lib/supabase-admin';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth) return jsonError(401, 'UNAUTHENTICATED', 'Sign in');
  const { id } = await params;
  if (!jobIdSchema.safeParse(id).success) return jsonError(400, 'INVALID_ID', 'Invalid job ID');

  const { data: job, error } = await auth.client.from('processing_jobs').select(jobSummaryFields)
    .eq('user_id', auth.user.id).eq('id', id).maybeSingle();
  if (error) return jsonError(503, 'JOBS_UNAVAILABLE', 'Could not load job');
  if (!job) return jsonError(404, 'NOT_FOUND', 'Job not found');
  return NextResponse.json({ job });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth) return jsonError(401, 'UNAUTHENTICATED', 'Sign in');
  if (!await sameOrigin(request)) return jsonError(403, 'ORIGIN_DENIED', 'Invalid origin');
  const { id } = await params;
  if (!jobIdSchema.safeParse(id).success) return jsonError(400, 'INVALID_ID', 'Invalid job ID');

  const { data, error } = await adminClient().from('processing_jobs')
    .update({ status: 'cancelled', leased_until: null, worker_id: null, completed_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', auth.user.id).in('status', ['created', 'uploading', 'queued', 'processing'])
    .select('status').maybeSingle();
  if (error) return jsonError(503, 'CANCEL_FAILED', 'Could not cancel job');
  if (!data) return jsonError(404, 'NOT_CANCELLABLE', 'No active job found');
  return NextResponse.json({ jobId: id, status: data.status });
}
