create table public.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  retry_after timestamptz not null default now()
);
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public, anon, authenticated;
grant select on public.account_deletion_requests to authenticated;
grant select, insert, update, delete on public.account_deletion_requests to service_role;
create policy "read own deletion request" on public.account_deletion_requests for select to authenticated
  using (user_id = (select auth.uid()));

insert into public.profiles(id) select id from auth.users on conflict (id) do nothing;
insert into public.user_settings(user_id) select id from auth.users on conflict (user_id) do nothing;

alter table public.admin_roles drop constraint admin_roles_granted_by_fkey;
alter table public.admin_roles add constraint admin_roles_granted_by_fkey
  foreign key (granted_by) references auth.users(id) on delete set null;
grant select on public.admin_roles to authenticated;
create policy "read own admin role" on public.admin_roles for select to authenticated
  using (user_id = (select auth.uid()));
alter table public.job_files add column cleanup_after timestamptz not null default now();

create function public.reject_jobs_for_deleted_accounts()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if exists (select 1 from public.account_deletion_requests where user_id = new.user_id) then
    raise exception using errcode = '42501', message = 'Account deletion is pending';
  end if;
  return new;
end;
$$;
create trigger prevent_jobs_for_deleted_accounts before insert on public.processing_jobs
  for each row execute function public.reject_jobs_for_deleted_accounts();

create function public.request_toolnest_account_deletion(p_user_id uuid)
returns void language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  insert into public.account_deletion_requests(user_id) values (p_user_id) on conflict do nothing;
  if found then
    insert into public.audit_logs(actor_id, action, target_type) values (p_user_id, 'account_deletion_requested', 'account');
  end if;

  update public.processing_jobs set status = 'cancelled', leased_until = null, worker_id = null,
    completed_at = now()
  where user_id = p_user_id and status in ('created', 'uploading', 'queued', 'processing');

  update public.job_files f set expires_at = least(f.expires_at, now())
  from public.processing_jobs j where j.id = f.job_id and j.user_id = p_user_id and f.kind = 'output' and f.published;
end;
$$;

create function public.toolnest_accounts_ready_for_deletion()
returns table(user_id uuid) language sql set search_path = '' as $$
  select d.user_id from public.account_deletion_requests d
  where d.retry_after <= now() and d.requested_at <= now() - interval '125 minutes'
  and not exists (
    select 1 from public.processing_jobs j join public.job_files f on f.job_id = j.id where j.user_id = d.user_id
  ) order by d.requested_at limit 100;
$$;

revoke all on function public.request_toolnest_account_deletion(uuid), public.toolnest_accounts_ready_for_deletion()
  from public, anon, authenticated;
grant execute on function public.request_toolnest_account_deletion(uuid), public.toolnest_accounts_ready_for_deletion()
  to service_role;
