import { NextResponse } from 'next/server';
import { jobIdSchema, jsonError, sameOrigin, uploadSchema } from '@/lib/api';
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
  const input = uploadSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return jsonError(400, 'INVALID_FILE', 'Invalid file metadata');

  const { data: job, error: jobError } = await auth.client.from('processing_jobs').select('status,expires_at')
    .eq('id', id).eq('user_id', auth.user.id).maybeSingle();
  if (jobError) return jsonError(503, 'JOBS_UNAVAILABLE', 'Could not load job');
  if (!job) return jsonError(404, 'NOT_FOUND', 'Job not found');
  if (!['created', 'uploading'].includes(job.status) || Date.parse(job.expires_at) <= Date.now()) {
    return jsonError(409, 'JOB_LOCKED', 'Job is not accepting uploads');
  }

  const admin = adminClient();
  const { data: file, error: fileError } = await admin.from('job_files').select('id,storage_path,size_bytes')
    .eq('job_id', id).eq('kind', 'input').eq('input_position', input.data.position).maybeSingle();
  if (fileError) return jsonError(503, 'UPLOAD_UNAVAILABLE', 'Could not load upload reservation');
  if (!file || file.size_bytes !== input.data.sizeBytes) {
    return jsonError(409, 'FILE_MISMATCH', 'File does not match its reservation');
  }
  const { data, error } = await admin.storage.from('temporary-files').createSignedUploadUrl(file.storage_path, { upsert: false });
  if (error || !data) return jsonError(503, 'UPLOAD_FAILED', 'Could not prepare upload');
  return NextResponse.json({ fileId: file.id, path: file.storage_path, token: data.token }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
