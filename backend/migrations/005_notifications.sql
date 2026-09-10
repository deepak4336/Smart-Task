-- Notifications module
-- Run in the Supabase SQL editor after schema.sql
-- Adds a task link for click-through, plus RLS so users only see their own rows.

alter table notifications
  add column if not exists task_id uuid references tasks(id) on delete cascade;

create index if not exists notifications_user_id_created_at_idx
  on notifications (user_id, created_at desc);

create index if not exists notifications_task_id_idx
  on notifications (task_id);

drop policy if exists "Users can view own notifications" on notifications;
create policy "Users can view own notifications"
  on notifications for select
  using (user_id = auth.uid());

drop policy if exists "Users can update own notifications" on notifications;
create policy "Users can update own notifications"
  on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, update on table notifications to authenticated;
grant all on table notifications to service_role;
