-- SmartTask database schema
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query)

create extension if not exists "uuid-ossp";

-- USERS
-- Mirrors auth.users (Supabase Auth) with app-specific profile fields.
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null default 'member' check (role in ('admin', 'manager', 'member')),
  created_at timestamptz default now()
);

-- WORKSPACES
create table workspaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_by uuid references users(id),
  created_at timestamptz default now()
);

-- WORKSPACE_MEMBERS
create table workspace_members (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'manager', 'member')),
  joined_at timestamptz default now(),
  unique (workspace_id, user_id)
);

-- PROJECTS
create table projects (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- BOARDS
create table boards (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- TASKS
create table tasks (
  id uuid primary key default uuid_generate_v4(),
  board_id uuid references boards(id) on delete cascade,
  assignee_id uuid references users(id),
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text default 'medium' check (priority in ('low', 'medium', 'high')),
  estimated_hours numeric default 1,        -- used by the workload dashboard
  due_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- TASK_DEPENDENCIES
-- A row means: task_id cannot start/finish until depends_on_id is done.
create table task_dependencies (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references tasks(id) on delete cascade,
  depends_on_id uuid references tasks(id) on delete cascade,
  created_at timestamptz default now(),
  check (task_id <> depends_on_id)
);

-- COMMENTS
create table comments (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references tasks(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  text text not null,
  created_at timestamptz default now()
);

-- NOTIFICATIONS
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  type text not null check (type in ('due_soon', 'overdue', 'dependency_shift', 'assigned', 'comment')),
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Enable RLS on every table, then add policies as each module is built.
-- Start permissive during development, tighten before submission/demo.
-- ============================================================

alter table users enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table projects enable row level security;
alter table boards enable row level security;
alter table tasks enable row level security;
alter table task_dependencies enable row level security;
alter table comments enable row level security;
alter table notifications enable row level security;

-- Example starter policy: users can read their own profile
create policy "Users can view own profile"
  on users for select
  using (auth.uid() = id);

-- Example starter policy: members can view tasks in workspaces they belong to
create policy "Members can view workspace tasks"
  on tasks for select
  using (
    board_id in (
      select b.id from boards b
      join projects p on p.id = b.project_id
      join workspace_members wm on wm.workspace_id = p.workspace_id
      where wm.user_id = auth.uid()
    )
  );

-- Add the remaining insert/update/delete policies per table as you build
-- each module — don't ship with RLS enabled but no policies (that blocks
-- everything) or disabled (that blocks nothing).
