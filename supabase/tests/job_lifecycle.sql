-- Run against an empty, disposable ToolNest database with all migrations applied.
begin;

insert into auth.users(id, email) values
  ('40000000-0000-4000-8000-000000000001', 'first@toolnest.example'),
  ('40000000-0000-4000-8000-000000000002', 'second@toolnest.example');
insert into public.admin_roles(user_id, role) values ('40000000-0000-4000-8000-000000000002', 'admin');
insert into public.favorites(user_id, tool_slug) values
  ('40000000-0000-4000-8000-000000000001', 'merge-pdf'),
  ('40000000-0000-4000-8000-000000000002', 'base64');

do $$
declare
  first_user constant uuid := '40000000-0000-4000-8000-000000000001';
  second_user constant uuid := '40000000-0000-4000-8000-000000000002';
  first_job uuid;
  second_job uuid;
  staged_path text;
  claimed public.processing_jobs;
begin
  if not exists (select 1 from storage.buckets where id = 'temporary-files' and not public
    and file_size_limit = 26214400 and allowed_mime_types = array['application/pdf']) then
    raise exception 'Temporary bucket settings are unsafe';
  end if;
  if has_function_privilege('authenticated', 'public.create_toolnest_merge(uuid, integer[])', 'execute')
    or has_function_privilege('anon', 'public.claim_toolnest_job(text)', 'execute')
    or has_function_privilege('authenticated', 'public.request_toolnest_account_deletion(uuid)', 'execute') then
    raise exception 'Privileged RPC exposed to clients';
  end if;

  first_job := public.create_toolnest_merge(first_user, array[10, 20]);
  second_job := public.create_toolnest_merge(second_user, array[30, 40]);
  perform set_config('toolnest.test.first_job', first_job::text, true);
  perform set_config('toolnest.test.second_job', second_job::text, true);
  if (select array_agg(size_bytes order by input_position) from public.job_files where job_id = first_job)
    is distinct from array[10, 20]::bigint[] then
    raise exception 'Input reservations lost their order';
  end if;

  for i in 2..20 loop
    if public.create_toolnest_merge(first_user, array[1, 1]) is null then
      raise exception 'Quota rejected a job before the limit';
    end if;
  end loop;
  if public.create_toolnest_merge(first_user, array[1, 1]) is not null then
    raise exception 'Expected the 21st job to hit the quota';
  end if;

  update public.processing_jobs set status = 'queued' where id = first_job;
  select * into claimed from public.claim_toolnest_job('first-attempt');
  if claimed.id is distinct from first_job or not public.renew_toolnest_lease(first_job, 'first-attempt') then
    raise exception 'Could not claim and renew job';
  end if;
  staged_path := public.stage_toolnest_output(first_job, 'first-attempt', 50);
  if staged_path is null or (select published from public.job_files where storage_path = staged_path) then
    raise exception 'Staged output is missing or visible prematurely';
  end if;
  update public.processing_jobs set leased_until = now() - interval '1 second' where id = first_job;
  select * into claimed from public.claim_toolnest_job('second-attempt');
  if claimed.id is distinct from first_job or claimed.attempt_count <> 2 then
    raise exception 'Expired lease was not recovered';
  end if;
  if public.finish_toolnest_job(first_job, 'first-attempt', staged_path) then
    raise exception 'Stale worker published after losing its lease';
  end if;
  staged_path := public.stage_toolnest_output(first_job, 'second-attempt', 50);
  if not public.finish_toolnest_job(first_job, 'second-attempt', staged_path) then
    raise exception 'Current worker could not finish the job';
  end if;
  if (select count(*) from public.job_files where job_id = first_job and kind = 'output' and published) <> 1 then
    raise exception 'Current worker did not publish exactly one result';
  end if;

  perform public.request_toolnest_account_deletion(second_user);
  if (select status from public.processing_jobs where id = second_job) <> 'cancelled' then
    raise exception 'Deletion request failed to cancel an active job';
  end if;
  begin
    perform public.create_toolnest_merge(second_user, array[1, 1]);
    raise exception 'Deletion request failed to stop new jobs';
  exception when insufficient_privilege then
    null;
  end;
  update public.account_deletion_requests set requested_at = now() - interval '126 minutes' where user_id = second_user;
  if exists (select 1 from public.toolnest_accounts_ready_for_deletion() where user_id = second_user) then
    raise exception 'Account is eligible for deletion before file cleanup';
  end if;
  delete from public.job_files where job_id = second_job;
  if not exists (select 1 from public.toolnest_accounts_ready_for_deletion() where user_id = second_user) then
    raise exception 'Account is not eligible after file cleanup';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000001', true);

do $$
begin
  if not exists (select 1 from public.processing_jobs where id = current_setting('toolnest.test.first_job')::uuid)
    or exists (select 1 from public.processing_jobs where id = current_setting('toolnest.test.second_job')::uuid)
    or exists (select 1 from public.account_deletion_requests)
    or exists (select 1 from public.job_files)
    or exists (select 1 from public.admin_roles)
    or (select array_agg(tool_slug) from public.favorites) is distinct from array['merge-pdf'] then
    raise exception 'Owner isolation failed';
  end if;
  begin
    insert into public.favorites(user_id, tool_slug) values ('40000000-0000-4000-8000-000000000002', 'rotate-pdf');
    raise exception 'Cross-account write was allowed';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

rollback;
