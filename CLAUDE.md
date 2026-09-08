# SmartTask — Project Context for AI Agents

## What this is
An intelligent task management web app (BCA final year project) that differentiates
itself from generic Kanban tools with three unique features: a workload balance
dashboard, dependency-aware auto-rescheduling, and an AI meeting-notes-to-task extractor.

## Tech stack
- **Frontend**: React (Vite), deployed on Vercel or Netlify
- **Backend**: Node.js + Express (REST API)
- **Database/Auth**: Supabase (PostgreSQL + Supabase Auth)
- **AI feature**: Google Gemini API or Groq API (free tier) for meeting-notes extraction —
  do NOT default to OpenAI, cost/signup friction is a concern for this project
- **Hosting**: Free tiers only — Supabase free tier, Vercel/Netlify free tier. Flag anything
  that risks exceeding free-tier limits.

## Local development
- **Backend port**: ALWAYS check `backend/.env`'s `PORT` value before assuming it — this
  has been 5000 or 5050 at different points on this machine (macOS AirPlay Receiver
  sometimes claims port 5000). Never hardcode a port number in code or docs; read it
  from `.env`.
- **Frontend port**: Vite default, usually 5173 (may shift to 5174+ if a previous
  instance is still running).
- `frontend/.env`'s `VITE_API_BASE_URL` MUST match whatever port the backend is
  actually running on — this mismatch has caused "Failed to fetch" errors repeatedly.
- Backend env vars live in `backend/.env`, frontend in `frontend/.env` (see each
  folder's `.env.example` for the template) — never commit either `.env` file.
- To stop a dev server, always use Ctrl+C (not Ctrl+Z, which suspends without
  releasing the port and causes EADDRINUSE on restart).

## Roles and access model
Three roles, stored in `users.role` and `workspace_members.role` as `admin`,
`manager`, `member` in the database — but the UI must display `manager` as
**"Team Leader"** everywhere (label-only rename; do not change the underlying
DB value, check constraints, or RLS policies to use a different string).

- **Admin**: sees and manages everything across the whole application
- **Team Leader** (DB value: `manager`): sees only the employees/tasks/tickets under
  their own team/project — NOT the whole workspace
- **Employee** (DB value: `member`): sees only their own data (own tasks, own
  workload, own tickets)

The Workload Dashboard specifically must respect this: Admin sees all, Team Leader
sees their own project's team only, Employee sees only themselves.

## Database schema (Supabase / Postgres)
Core tables — see `/docs/er-diagram.png` for the original ER diagram (note: `tickets`
table below was added after that diagram was drawn, not yet reflected in it):
- `users` (id, name, email, role)
- `workspaces` (id, name)
- `workspace_members` (id, workspace_id FK, user_id FK, role)
- `projects` (id, workspace_id FK, name)
- `boards` (id, project_id FK, name)
- `tasks` (id, board_id FK, assignee_id FK, title, status, due_date, priority)
- `task_dependencies` (id, task_id FK, depends_on_id FK)
- `comments` (id, task_id FK, user_id FK, text)
- `notifications` (id, user_id FK, type, message)
- `tickets` (NOT YET CREATED — needed for the Tickets module: id, workspace_id FK,
  raised_by FK, assignee_id FK, title, description, status, priority, created_at.
  Distinct workflow from tasks — do not reuse the tasks table for tickets.)

## App structure (sidebar shell)
The frontend uses a sidebar navigation layout (reference: an internal "Takora Mart
Work OS" app, restyled with SmartTask's own color tokens from
`frontend/src/styles/theme.css` — do NOT copy Takora Mart's color scheme, only its
layout pattern). Sidebar items, role-aware:
- Dashboard (Workload Dashboard — Module 5, scoped per role as above)
- Tasks (Kanban board — already built in Phase 3)
- Tickets (new module, see above)
- Reports (analytics — status/priority breakdowns, completion trends; can start simple)
- Profile (view/edit own user details)

## Modules (build order — see phased roadmap)
1. Authentication & user management — DONE (Phase 2)
2. Workspace & project management — DONE (Phase 2)
3. Task management (CRUD, Kanban board, drag-and-drop) — DONE (Phase 3), built via
   Cursor agent on branch `cursor/task-management-kanban`
4. Dependency engine (linking tasks, auto-reschedule on delay, flag affected chains)
   — NOT STARTED
5. Workload balance dashboard (role-scoped as described above) — IN PROGRESS (Phase 4)
6. AI meeting notes → task extractor (NLP extraction via Gemini/Groq) — NOT STARTED
7. Notifications & activity log — NOT STARTED
8. Tickets module — IN PROGRESS (Phase 4)
9. Reports/analytics — IN PROGRESS (Phase 4)

## Conventions
- Keep components small and colocated by feature (e.g. `/features/tasks/`,
  `/features/tickets/`, `/features/reports/`)
- All Supabase queries go through a thin data-access layer — don't scatter raw
  Supabase calls across components
- Role-based access checks happen both client-side (UX, e.g. hiding sidebar items)
  and via Supabase Row Level Security policies (actual security) — never rely on
  client-side checks alone. Every new table (starting with `tickets`) needs RLS
  policies before being considered done, following the pattern in
  `backend/migrations/002_auth_trigger_and_workspace_rls.sql`.
- Cache AI extraction responses where reasonable to avoid redundant API calls
  during dev/demo
- This is a solo student project on a deadline — prefer simple, working solutions
  over premature abstraction or enterprise-style over-engineering
- Build in small, isolated agent sessions (one module/feature per session), not one
  giant multi-feature prompt — verify each piece works before starting the next