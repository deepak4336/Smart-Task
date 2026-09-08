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

## Database schema (Supabase / Postgres)
Core tables and relationships — see `/docs/er-diagram.png` for the full ER diagram:
- `users` (id, name, email, role)
- `workspaces` (id, name)
- `workspace_members` (id, workspace_id FK, user_id FK)
- `projects` (id, workspace_id FK, name)
- `boards` (id, project_id FK, name)
- `tasks` (id, board_id FK, assignee_id FK, title, status, due_date, priority)
- `task_dependencies` (id, task_id FK, depends_on_id FK)
- `comments` (id, task_id FK, user_id FK, text)
- `notifications` (id, user_id FK, type, message)

## Modules (build order — see phased roadmap)
1. Authentication & user management (roles: Admin, Manager, Member) — DONE (Phase 2)
2. Workspace & project management — workspace create/list/invite DONE, project/board CRUD pending
3. Task management (CRUD, Kanban board, drag-and-drop)
4. Dependency engine (linking tasks, auto-reschedule on delay, flag affected chains)
5. Workload balance dashboard (effort-based load visualization per member)
6. AI meeting notes → task extractor (NLP extraction via Gemini/Groq)
7. Notifications & activity log
8. Analytics/reporting (optional/future scope — low priority)

## Conventions
- Keep components small and colocated by feature (e.g. `/features/tasks/`, `/features/dependencies/`)
- All Supabase queries go through a thin data-access layer — don't scatter raw Supabase
  calls across components
- Role-based access checks happen both client-side (UX) and via Supabase Row Level
  Security policies (actual security) — never rely on client-side checks alone
- Cache AI extraction responses where reasonable to avoid redundant API calls during dev/demo
- This is a solo student project on a deadline — prefer simple, working solutions over
  premature abstraction or enterprise-style over-engineering
