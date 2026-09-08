# SmartTask — Intelligent Task Management System

BCA final year project. See CLAUDE.md for full project context.

## Structure
- `frontend/` — React (Vite) app
- `backend/` — Node.js + Express API
- `backend/schema.sql` — Supabase database schema (run this in the Supabase SQL editor)

## Setup

### 1. Supabase
1. Create a project at supabase.com
2. Go to SQL Editor > New query, paste the contents of `backend/schema.sql`, run it
3. Copy your Project URL and service_role key from Project Settings > API

### 2. Backend
```
cd backend
cp .env.example .env   # fill in your Supabase URL + service role key
npm install
npm run dev
```
Visit http://localhost:5000/api/health — should show `"database": "connected"`.

### 3. Frontend
```
cd frontend
npm install
npm run dev
```
Visit http://localhost:5173

## Next steps
Follow the phased roadmap: Phase 2 (auth, workspaces, task CRUD + Kanban board) is next.
# Smart-Task
