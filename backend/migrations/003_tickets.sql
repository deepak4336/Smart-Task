-- Phase 4: Tickets module
-- Run this in the Supabase SQL editor after 002_auth_trigger_and_workspace_rls.sql

create table if not exists tickets (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  raised_by uuid not null references users(id) on delete cascade,
  assignee_id uuid references users(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists tickets_workspace_id_idx on tickets (workspace_id);
create index if not exists tickets_raised_by_idx on tickets (raised_by);
create index if not exists tickets_assignee_id_idx on tickets (assignee_id);

alter table tickets enable row level security;

-- Members can view tickets in workspaces they belong to.
-- Fine-grained role scoping (admin / Team Leader / employee) is enforced in the API.
create policy "Members can view workspace tickets"
  on tickets for select
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

create policy "Members can create tickets in their workspaces"
  on tickets for insert
  with check (
    raised_by = auth.uid()
    and workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

-- Status (and other fields): raiser, assignee, or workspace admin/manager.
create policy "Raiser, assignee, or leads can update tickets"
  on tickets for update
  using (
    raised_by = auth.uid()
    or assignee_id = auth.uid()
    or exists (
      select 1 from workspace_members wm
      where wm.workspace_id = tickets.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('admin', 'manager')
    )
  );

create policy "Raiser or leads can delete tickets"
  on tickets for delete
  using (
    raised_by = auth.uid()
    or exists (
      select 1 from workspace_members wm
      where wm.workspace_id = tickets.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('admin', 'manager')
    )
  );

grant select, insert, update, delete on table tickets to authenticated;
grant all on table tickets to service_role;
