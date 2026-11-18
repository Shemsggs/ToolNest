alter table public.processing_jobs add column available_at timestamptz not null default now();
alter table public.job_files add column published boolean not null default true;
create index processing_jobs_expiry on public.processing_jobs(expires_at)
  where status in ('created', 'uploading', 'queued', 'processing', 'completed');
create index processing_jobs_active_lease on public.processing_jobs(leased_until) where status = 'processing';

create or replace function public.claim_toolnest_job(p_worker_id text)
returns setof public.processing_jobs language plpgsql set search_path = '' as $$
begin
  update public.processing_jobs set status = 'expired', completed_at = coalesce(completed_at, now()),
    worker_id = null, leased_until = null
  where expires_at <= now() and status in ('created', 'uploading', 'queued', 'processing', 'completed');

  update public.processing_jobs set status = case when attempt_count < 3 then 'queued' else 'failed' end,
    error_code = case when attempt_count < 3 then null else 'WORKER_LOST' end,
    completed_at = case when attempt_count < 3 then null else now() end,
    available_at = now(), worker_id = null, leased_until = null
  where status = 'processing' and coalesce(leased_until, '-infinity'::timestamptz) <= now();

  return query update public.processing_jobs j set status = 'processing', attempt_count = j.attempt_count + 1,
    leased_until = now() + interval '3 minutes', worker_id = p_worker_id, started_at = now()
  where j.id = (select q.id from public.processing_jobs q
    where q.status = 'queued' and q.attempt_count < 3 and q.available_at <= now() and q.expires_at > now()
    order by q.created_at, q.id for update skip locked limit 1)
  returning j.*;
end;
$$;

create function public.renew_toolnest_lease(p_job_id uuid, p_worker_id text)
returns boolean language sql set search_path = '' as $$
  with renewed as (
    update public.processing_jobs set leased_until = now() + interval '3 minutes'
    where id = p_job_id and worker_id = p_worker_id and status = 'processing'
      and leased_until > now() and expires_at > now() returning id
  ) select exists(select 1 from renewed);
$$;

create function public.stage_toolnest_output(p_job_id uuid, p_worker_id text, p_size integer)
returns text language plpgsql set search_path = '' as $$
declare
  v_user_id uuid;
  v_path text;
begin
  if p_size not between 1 and 26214400 then
    raise exception using errcode = '22023', message = 'Invalid output size';
  end if;

  select user_id into v_user_id from public.processing_jobs
    where id = p_job_id and worker_id = p_worker_id and status = 'processing'
      and leased_until > now() and expires_at > now() for update;
  if not found then return null; end if;

  v_path := v_user_id::text || '/' || p_job_id::text || '/results/' || gen_random_uuid()::text || '.pdf';
  insert into public.job_files(job_id, kind, storage_path, content_type, size_bytes, expires_at, published)
  values (p_job_id, 'output', v_path, 'application/pdf', p_size, now() + interval '10 minutes', false);
  return v_path;
end;
$$;

create function public.finish_toolnest_job(p_job_id uuid, p_worker_id text, p_path text)
returns boolean language plpgsql set search_path = '' as $$
declare
  v_expiry timestamptz := now() + interval '1 hour';
begin
  perform 1 from public.processing_jobs
    where id = p_job_id and worker_id = p_worker_id and status = 'processing'
      and leased_until > now() and expires_at > now() for update;
  if not found then return false; end if;

  update public.job_files set published = true, expires_at = v_expiry
    where job_id = p_job_id and kind = 'output' and storage_path = p_path and not published and expires_at > now();
  if not found then return false; end if;

  update public.processing_jobs set status = 'completed', completed_at = now(), expires_at = v_expiry,
    error_code = null, leased_until = null, worker_id = null where id = p_job_id;
  return true;
end;
$$;

create function public.fail_toolnest_job(p_job_id uuid, p_worker_id text, p_code text, p_retry boolean)
returns void language sql set search_path = '' as $$
  update public.processing_jobs set
    status = case when p_retry and attempt_count < 3 then 'queued' else 'failed' end,
    error_code = case when p_retry and attempt_count < 3 then null else p_code end,
    completed_at = case when p_retry and attempt_count < 3 then null else now() end,
    available_at = now() + attempt_count * interval '15 seconds', worker_id = null, leased_until = null
  where id = p_job_id and worker_id = p_worker_id and status = 'processing'
    and leased_until > now() and expires_at > now();
$$;

revoke all on function public.renew_toolnest_lease(uuid, text), public.stage_toolnest_output(uuid, text, integer),
  public.finish_toolnest_job(uuid, text, text), public.fail_toolnest_job(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.renew_toolnest_lease(uuid, text), public.stage_toolnest_output(uuid, text, integer),
  public.finish_toolnest_job(uuid, text, text), public.fail_toolnest_job(uuid, text, text, boolean) to service_role;
