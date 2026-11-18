import { NextResponse } from 'next/server';
import { jobIdSchema, jsonError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { adminClient } from '@/lib/supabase-admin';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth) return jsonError(401, 'UNAUTHENTICATED', 'Sign in');
  const { id } = await params;
  if (!jobIdSchema.safeParse(id).success) return jsonError(400, 'INVALID_ID', 'Invalid job ID');

  const { data: job, error: jobError } = await auth.client.from('processing_jobs').select('status,expires_at')
    .eq('id', id).eq('user_id', auth.user.id).maybeSingle();
  if (jobError) return jsonError(503, 'JOBS_UNAVAILABLE', 'Could not load job');
  if (!job) return jsonError(404, 'NOT_FOUND', 'Job not found');
  if (job.status !== 'completed') return jsonError(409, 'NOT_READY', 'Result is not available');

  const admin = adminClient();
  const { data: file, error: fileError } = await admin.from('job_files').select('storage_path,expires_at')
    .eq('job_id', id).eq('kind', 'output').eq('published', true).order('created_at', { ascending: false })
    .order('id').limit(1).maybeSingle();
  if (fileError) return jsonError(503, 'FILES_UNAVAILABLE', 'Could not load result');
  if (!file) return jsonError(404, 'EXPIRED', 'Result expired');
  const expiresAt = Math.min(Date.parse(job.expires_at), Date.parse(file.expires_at));
  const expiresInSeconds = Math.min(300, Math.floor((expiresAt - Date.now()) / 1000));
  if (expiresInSeconds < 1) return jsonError(404, 'EXPIRED', 'Result expired');

  const { data, error } = await admin.storage.from('temporary-files')
    .createSignedUrl(file.storage_path, expiresInSeconds, { download: 'merged.pdf' });
  if (error || !data) return jsonError(503, 'SIGN_FAILED', 'Could not prepare download');
  return NextResponse.json({ url: data.signedUrl, expiresInSeconds }, { headers: { 'Cache-Control': 'no-store' } });
}
