import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { adminClient } from '@/lib/supabase-admin';
import { createJobSchema, jobSummaryFields, jsonError, sameOrigin } from '@/lib/api';
import { serverProcessingEnabled } from '@/lib/config';

export async function GET() {
  const auth = await requireUser();
  if (!auth) return jsonError(401, 'UNAUTHENTICATED', 'Sign in');

  const { data, error } = await auth.client.from('processing_jobs').select(jobSummaryFields)
    .eq('user_id', auth.user.id).order('created_at', { ascending: false }).limit(30);
  if (error) return jsonError(503, 'JOBS_UNAVAILABLE', 'Could not load jobs');
  return NextResponse.json({ jobs: data });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) return jsonError(401, 'UNAUTHENTICATED', 'Sign in');
  if (!await sameOrigin(request)) return jsonError(403, 'ORIGIN_DENIED', 'Invalid origin');
  if (!serverProcessingEnabled()) return jsonError(503, 'PROCESSING_DISABLED', 'Server processing is disabled');

  const input = createJobSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return jsonError(400, 'INVALID_JOB', 'Select 2 to 10 PDFs of up to 25 MiB each');

  const { data: jobId, error } = await adminClient().rpc('create_toolnest_merge', {
    p_user_id: auth.user.id,
    p_sizes: input.data.files.map(file => file.sizeBytes),
  });
  if (error) return jsonError(503, 'JOB_CREATE_FAILED', 'Could not create job');
  if (!jobId) return jsonError(429, 'JOB_QUOTA', 'You reached the 24-hour server job limit');
  return NextResponse.json({ jobId, status: 'created' }, { status: 201 });
}
