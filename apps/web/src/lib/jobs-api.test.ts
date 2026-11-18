import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as listJobs, POST as createJob } from '@/app/api/v1/jobs/route';
import { GET as getJob, DELETE as cancelJob } from '@/app/api/v1/jobs/[id]/route';
import { POST as prepareUpload } from '@/app/api/v1/jobs/[id]/uploads/route';
import { PATCH as saveSettings } from '@/app/api/v1/settings/route';

const { requireUser, adminClient } = vi.hoisted(() => ({ requireUser: vi.fn(), adminClient: vi.fn() }));
vi.mock('@/lib/auth', () => ({ requireUser }));
vi.mock('@/lib/supabase-admin', () => ({ adminClient }));

const jobId = '079eacdd-bd21-4bbe-9ef1-4afaf61d383e';
const owner = 'owner';
const context = { params: Promise.resolve({ id: jobId }) };
const endpoint = 'https://toolnest.example/api/v1/jobs';
const metadata = { name: 'input.pdf', sizeBytes: 12, contentType: 'application/pdf' };

function request(method: string, body?: unknown, origin = 'https://toolnest.example') {
  return new Request(endpoint, { method, headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

function table(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result), maybeSingle: vi.fn().mockResolvedValue(result),
  };
}

describe('authenticated API trust boundaries', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    requireUser.mockResolvedValue({ user: { id: owner }, client: { from: vi.fn() } });
  });

  it('denies unauthenticated reads', async () => {
    requireUser.mockResolvedValue(null);
    expect((await listJobs()).status).toBe(401);
  });

  it('scopes individual reads to the signed-in owner', async () => {
    const jobs = table({ data: null, error: null });
    requireUser.mockResolvedValue({ user: { id: owner }, client: { from: vi.fn().mockReturnValue(jobs) } });
    expect((await getJob(new Request(endpoint), context)).status).toBe(404);
    expect(jobs.eq).toHaveBeenCalledWith('user_id', owner);
    expect(jobs.eq).toHaveBeenCalledWith('id', jobId);
    expect(adminClient).not.toHaveBeenCalled();
  });

  it('denies cross-origin mutations before using service credentials', async () => {
    const foreignRequest = request('POST', {}, 'https://other.example');
    expect((await createJob(foreignRequest)).status).toBe(403);
    expect((await prepareUpload(foreignRequest, context)).status).toBe(403);
    expect((await cancelJob(foreignRequest, context)).status).toBe(403);
    expect((await saveSettings(foreignRequest)).status).toBe(403);
    expect(adminClient).not.toHaveBeenCalled();
  });

  it('keeps server processing off by default', async () => {
    vi.stubEnv('TOOLNEST_SERVER_PROCESSING_ENABLED', undefined);
    expect((await createJob(request('POST'))).status).toBe(503);
    expect(adminClient).not.toHaveBeenCalled();
  });

  it('validates metadata and reserves ordered inputs under the verified account', async () => {
    vi.stubEnv('TOOLNEST_SERVER_PROCESSING_ENABLED', 'true');
    const rpc = vi.fn().mockResolvedValue({ data: jobId, error: null });
    adminClient.mockReturnValue({ rpc });
    const files = [metadata, { ...metadata, sizeBytes: 25 }];
    expect((await createJob(request('POST', { tool: 'merge-pdf', files, userId: 'other' }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
    const response = await createJob(request('POST', { tool: 'merge-pdf', files }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ jobId, status: 'created' });
    expect(rpc).toHaveBeenCalledWith('create_toolnest_merge', { p_user_id: owner, p_sizes: [12, 25] });
  });

  it('reports the database quota and does not grant an upload token to another user', async () => {
    vi.stubEnv('TOOLNEST_SERVER_PROCESSING_ENABLED', 'true');
    adminClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: null }) });
    expect((await createJob(request('POST', { tool: 'merge-pdf', files: [metadata, metadata] }))).status).toBe(429);
    adminClient.mockClear();
    const jobs = table({ data: null, error: null });
    requireUser.mockResolvedValue({ user: { id: owner }, client: { from: vi.fn().mockReturnValue(jobs) } });
    const upload = request('POST', { filename: metadata.name, sizeBytes: metadata.sizeBytes, contentType: metadata.contentType, position: 0 });
    expect((await prepareUpload(upload, context)).status).toBe(404);
    expect(adminClient).not.toHaveBeenCalled();
  });
});
