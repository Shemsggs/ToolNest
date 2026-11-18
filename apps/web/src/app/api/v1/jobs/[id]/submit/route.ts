import { NextResponse } from 'next/server';
import { jobIdSchema, jsonError, sameOrigin } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { serverProcessingEnabled } from '@/lib/config';
import { adminClient } from '@/lib/supabase-admin';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth) return jsonError(401, 'UNAUTHENTICATED', 'Sign in');
  if (!await sameOrigin(request)) return jsonError(403, 'ORIGIN_DENIED', 'Invalid origin');
  if (!serverProcessingEnabled()) return jsonError(503, 'PROCESSING_DISABLED', 'Server processing is disabled');
  const { id } = await params;
  if (!jobIdSchema.safeParse(id).success) return jsonError(400, 'INVALID_ID', 'Invalid job ID');

  const { data: job, error: jobError } = await auth.client.from('processing_jobs').select('status,expires_at,input_file_count')
    .eq('id', id).eq('user_id', auth.user.id).maybeSingle();
  if (jobError) return jsonError(503, 'JOBS_UNAVAILABLE', 'Could not load job');
  if (!job) return jsonError(404, 'NOT_FOUND', 'Job not found');
  if (Date.parse(job.expires_at) <= Date.now()) return jsonError(409, 'JOB_EXPIRED', 'Job expired');
  if (['queued', 'processing', 'completed'].includes(job.status)) return NextResponse.json({ jobId: id, status: job.status });
  if (!['created', 'uploading'].includes(job.status)) return jsonError(409, 'INVALID_STATUS', 'Job cannot be queued');

  const admin = adminClient();
  const { data: files, error: fileError } = await admin.from('job_files').select('storage_path,size_bytes')
    .eq('job_id', id).eq('kind', 'input');
  if (fileError) return jsonError(503, 'FILES_UNAVAILABLE', 'Could not verify file reservations');
  if (files.length !== job.input_file_count) return jsonError(422, 'INCOMPLETE_UPLOAD', 'File reservations are incomplete');

  const { data: objects, error: listError } = await admin.storage.from('temporary-files')
    .list(`${auth.user.id}/${id}/inputs`, { limit: 20 });
  if (listError) return jsonError(503, 'STORAGE_UNAVAILABLE', 'Could not verify uploads');
  if (!files.every(file => objects.some(object => object.name === file.storage_path.split('/').at(-1)
    && object.metadata?.size === file.size_bytes && object.metadata?.mimetype === 'application/pdf'))) {
    return jsonError(422, 'INCOMPLETE_UPLOAD', 'Upload sizes or file types do not match the reservations');
  }

  const { data: queued, error } = await admin.from('processing_jobs').update({ status: 'queued' })
    .eq('id', id).eq('user_id', auth.user.id).in('status', ['created', 'uploading'])
    .gt('expires_at', new Date().toISOString()).select('status').maybeSingle();
  if (error) return jsonError(503, 'QUEUE_FAILED', 'Could not queue job');
  if (!queued) return jsonError(409, 'JOB_CHANGED', 'Job status changed. Check its current status.');
  return NextResponse.json({ jobId: id, status: queued.status });
}
