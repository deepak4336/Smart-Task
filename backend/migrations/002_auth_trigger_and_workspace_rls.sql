-- Phase 2: Auth sync trigger + workspace RLS policies
-- Run this in the Supabase SQL editor, after schema.sql

-- ============================================================
-- Auto-create a public.users row whenever someone signs up
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    'member'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Workspace RLS policies
-- ============================================================

-- Any authenticated user can create a workspace
create policy "Authenticated users can create workspaces"
  on workspaces for insert
  with check (auth.uid() = created_by);

-- Members can view workspaces they belong to
create policy "Members can view their workspaces"
  on workspaces for select
  using (
    id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

-- Workspace creator can add members (invite flow goes through backend using
-- the service role key, so this policy mainly documents intent — the
-- backend bypasses RLS with the service role for the actual insert)
create policy "Members can view their own membership rows"
  on workspace_members for select
  using (user_id = auth.uid());

create policy "Members can view co-members in their workspaces"
  on workspace_members for select
  using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );
