-- Keep Data API access explicit on hosted projects and local stacks.
revoke all on public.processing_jobs, public.job_files from public, anon, authenticated;
revoke update on public.profiles from public, anon, authenticated;

grant select on public.profiles, public.user_settings, public.tools, public.favorites,
  public.processing_jobs, public.usage_events to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant update on public.user_settings to authenticated;
grant insert, delete on public.favorites to authenticated;

grant select, insert, update on public.processing_jobs to service_role;
grant select, insert, update, delete on public.job_files to service_role;
grant insert on public.audit_logs to service_role;
