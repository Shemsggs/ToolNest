-- ToolNest initial schema. Apply via Supabase CLI migrations.
create extension if not exists pgcrypto;
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, display_name text check(char_length(display_name)<=100), created_at timestamptz not null default now());
create table public.user_settings (user_id uuid primary key references auth.users(id) on delete cascade, theme text not null default 'light' check(theme in ('light','dark')), preferences jsonb not null default '{}'::jsonb);
create table public.tools (slug text primary key, name text not null, category text not null check(category in ('pdf','image','developer')), enabled boolean not null default true);
create table public.favorites(user_id uuid not null references auth.users(id) on delete cascade, tool_slug text not null references public.tools(slug), created_at timestamptz not null default now(), primary key(user_id,tool_slug));
create table public.processing_jobs (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,tool_slug text not null references public.tools(slug),
 status text not null default 'created' check(status in ('created','uploading','queued','processing','completed','failed','cancelled','expired')),
 options jsonb not null default '{}'::jsonb,input_file_count integer not null check(input_file_count between 1 and 10),
 attempt_count integer not null default 0,leased_until timestamptz,worker_id text,error_code text,
 created_at timestamptz not null default now(),started_at timestamptz,completed_at timestamptz,expires_at timestamptz not null default(now()+interval '1 hour')
);
create table public.job_files (
 id uuid primary key default gen_random_uuid(),job_id uuid not null references public.processing_jobs(id) on delete cascade,kind text not null check(kind in ('input','output')),
 storage_path text not null unique,content_type text not null,size_bytes bigint not null check(size_bytes>=0),
 created_at timestamptz not null default now(),expires_at timestamptz not null
);
create table public.usage_events(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,tool_slug text not null references public.tools(slug),execution_mode text not null check(execution_mode in ('browser','server')),created_at timestamptz not null default now());
create table public.admin_roles(user_id uuid primary key references auth.users(id) on delete cascade,role text not null check(role in ('admin','security_admin')),granted_by uuid references auth.users(id),created_at timestamptz not null default now());
create table public.audit_logs(id uuid primary key default gen_random_uuid(),actor_id uuid references auth.users(id) on delete set null,action text not null,target_type text,target_id text,created_at timestamptz not null default now());
create index processing_jobs_owner_time on public.processing_jobs(user_id,created_at desc);
create index processing_jobs_queue on public.processing_jobs(status,created_at) where status in ('queued','processing');
create index job_files_expiry on public.job_files(expires_at);
create index usage_events_owner_time on public.usage_events(user_id,created_at desc);

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.tools enable row level security;
alter table public.favorites enable row level security;
alter table public.processing_jobs enable row level security;
alter table public.job_files enable row level security;
alter table public.usage_events enable row level security;
alter table public.admin_roles enable row level security;
alter table public.audit_logs enable row level security;
create policy "read own profile" on public.profiles for select to authenticated using (id=(select auth.uid()));
create policy "update own profile" on public.profiles for update to authenticated using (id=(select auth.uid())) with check(id=(select auth.uid()));
create policy "read own settings" on public.user_settings for select to authenticated using (user_id=(select auth.uid()));
create policy "update own settings" on public.user_settings for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "read enabled tools" on public.tools for select to authenticated using(enabled);
create policy "read own favorites" on public.favorites for select to authenticated using(user_id=(select auth.uid()));
create policy "insert own favorites" on public.favorites for insert to authenticated with check(user_id=(select auth.uid()));
create policy "delete own favorites" on public.favorites for delete to authenticated using(user_id=(select auth.uid()));
create policy "read own jobs" on public.processing_jobs for select to authenticated using(user_id=(select auth.uid()));
create policy "read own usage" on public.usage_events for select to authenticated using(user_id=(select auth.uid()));
-- Client inserts/updates to job and file tables are prohibited by RLS: BFF controls all writes.
create or replace function public.new_user_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id) values(new.id);insert into public.user_settings(user_id) values(new.id);return new;end;$$;
create trigger toolnest_user_created after insert on auth.users for each row execute function public.new_user_profile();

insert into public.tools(slug,name,category) values
('merge-pdf','Merge PDF','pdf'),('split-pdf','Split PDF','pdf'),('rotate-pdf','Rotate PDF','pdf'),('extract-pdf','Extract PDF pages','pdf'),
('resize-image','Resize image','image'),('convert-image','Convert image','image'),('compress-image','Compress image','image'),('crop-image','Crop image','image'),
('qr-code','QR generator','developer'),('json-formatter','JSON formatter','developer'),('base64','Base64 converter','developer'),('text-case','Text case converter','developer')
on conflict (slug) do nothing;

-- Atomic job claim is restricted to backend service role. Do not GRANT to authenticated/anon.
create or replace function public.claim_toolnest_job(p_worker_id text) returns setof public.processing_jobs language plpgsql security definer set search_path='' as $$
begin
 return query update public.processing_jobs j set status='processing',attempt_count=j.attempt_count+1,leased_until=now()+interval '3 minutes',worker_id=p_worker_id,started_at=now()
 where j.id=(select q.id from public.processing_jobs q where q.status='queued' and q.attempt_count<3 order by q.created_at for update skip locked limit 1)
 returning j.*;
end;$$;
revoke all on function public.claim_toolnest_job(text) from public,anon,authenticated;
grant execute on function public.claim_toolnest_job(text) to service_role;

-- Create a private bucket through migration. Signed upload and download URLs only.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('temporary-files','temporary-files',false,26214400,array['application/pdf'])
on conflict(id) do nothing;
