alter table public.job_files add column input_position integer
  check (input_position is null or (input_position between 0 and 9 and kind = 'input'));
create unique index job_files_input_position on public.job_files(job_id, input_position)
  where input_position is not null;
create index job_files_by_job on public.job_files(job_id, kind);

update storage.buckets set public = false, file_size_limit = 26214400,
  allowed_mime_types = array['application/pdf'] where id = 'temporary-files';

-- Keep metadata until all upload tokens issued before job expiry have elapsed.
update public.job_files f set expires_at = greatest(f.expires_at, j.expires_at + interval '125 minutes')
from public.processing_jobs j where j.id = f.job_id and f.kind = 'input';

create function public.create_toolnest_merge(p_user_id uuid, p_sizes integer[])
returns uuid language plpgsql set search_path = '' as $$
declare
  v_job public.processing_jobs;
begin
  if coalesce(cardinality(p_sizes), 0) not between 2 and 10 or exists (
    select 1 from unnest(p_sizes) as bytes where bytes is null or bytes not between 1 and 26214400
  ) then
    raise exception using errcode = '22023', message = 'Invalid file sizes';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  if (select count(*) from public.processing_jobs
      where user_id = p_user_id and created_at >= now() - interval '24 hours') >= 20 then
    return null;
  end if;

  insert into public.processing_jobs(user_id, tool_slug, input_file_count)
  values (p_user_id, 'merge-pdf', cardinality(p_sizes)) returning * into v_job;

  insert into public.job_files(job_id, kind, storage_path, content_type, size_bytes, expires_at, input_position)
  select v_job.id, 'input', p_user_id::text || '/' || v_job.id::text || '/inputs/' || gen_random_uuid()::text || '.pdf',
         'application/pdf', bytes, v_job.expires_at + interval '125 minutes', (position - 1)::integer
  from unnest(p_sizes) with ordinality as file(bytes, position);

  return v_job.id;
end;
$$;

revoke all on function public.create_toolnest_merge(uuid, integer[]) from public, anon, authenticated;
grant execute on function public.create_toolnest_merge(uuid, integer[]) to service_role;
