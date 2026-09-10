-- Phase 3/4: Task dependency engine
-- Run in the Supabase SQL editor after 002_auth_trigger_and_workspace_rls.sql
-- The task_dependencies table is created in schema.sql; this tightens constraints + RLS.

create unique index if not exists task_dependencies_unique_pair
  on task_dependencies (task_id, depends_on_id);

create index if not exists task_dependencies_task_id_idx on task_dependencies (task_id);
create index if not exists task_dependencies_depends_on_id_idx on task_dependencies (depends_on_id);

-- Members can see/link dependencies for tasks in workspaces they belong to.
-- Fine-grained role scoping stays in the API (same as tasks).
drop policy if exists "Members can view task dependencies" on task_dependencies;
create policy "Members can view task dependencies"
  on task_dependencies for select
  using (
    task_id in (
      select t.id from tasks t
      join boards b on b.id = t.board_id
      join projects p on p.id = b.project_id
      join workspace_members wm on wm.workspace_id = p.workspace_id
      where wm.user_id = auth.uid()
    )
  );

drop policy if exists "Members can create task dependencies" on task_dependencies;
create policy "Members can create task dependencies"
  on task_dependencies for insert
  with check (
    task_id in (
      select t.id from tasks t
      join boards b on b.id = t.board_id
      join projects p on p.id = b.project_id
      join workspace_members wm on wm.workspace_id = p.workspace_id
      where wm.user_id = auth.uid()
    )
    and depends_on_id in (
      select t.id from tasks t
      join boards b on b.id = t.board_id
      join projects p on p.id = b.project_id
      join workspace_members wm on wm.workspace_id = p.workspace_id
      where wm.user_id = auth.uid()
    )
  );

drop policy if exists "Members can delete task dependencies" on task_dependencies;
create policy "Members can delete task dependencies"
  on task_dependencies for delete
  using (
    task_id in (
      select t.id from tasks t
      join boards b on b.id = t.board_id
      join projects p on p.id = b.project_id
      join workspace_members wm on wm.workspace_id = p.workspace_id
      where wm.user_id = auth.uid()
    )
  );

grant select, insert, delete on table task_dependencies to authenticated;
grant all on table task_dependencies to service_role;
