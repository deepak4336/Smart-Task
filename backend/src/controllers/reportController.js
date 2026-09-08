import { supabase } from '../config/supabaseClient.js';

const TASK_STATUSES = ['todo', 'in_progress', 'done'];
const TASK_PRIORITIES = ['low', 'medium', 'high'];
const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

function emptyCounts(keys) {
  return Object.fromEntries(keys.map((k) => [k, 0]));
}

function dateKeyUTC(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

function last7DayKeys() {
  const keys = [];
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (let i = 6; i >= 0; i--) {
    keys.push(new Date(start - i * 86400000).toISOString().slice(0, 10));
  }
  return keys;
}

async function getWorkspaceAccess(userId, workspaceId) {
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) {
    return { error: { status: 403, message: 'Not a member of this workspace' } };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  const appRole = profile?.role || 'member';
  const workspaceRole = membership.role;
  const isAdmin = appRole === 'admin' || workspaceRole === 'admin';
  const isManager = !isAdmin && (workspaceRole === 'manager' || appRole === 'manager');

  return { membership, appRole, workspaceRole, isAdmin, isManager };
}

/** Team Leader team = themselves + workspace employees (role member). */
async function getTeamUserIds(workspaceId, managerId) {
  const ids = new Set([managerId]);

  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', workspaceId);

  for (const m of members || []) {
    if (m.role === 'member') ids.add(m.user_id);
  }

  return [...ids];
}

async function loadWorkspaceTasks(workspaceId) {
  const { data: projects, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('workspace_id', workspaceId);

  if (projectError) return { error: projectError.message, tasks: [] };

  const projectIds = (projects || []).map((p) => p.id);
  if (projectIds.length === 0) return { tasks: [] };

  const { data: boards, error: boardError } = await supabase
    .from('boards')
    .select('id')
    .in('project_id', projectIds);

  if (boardError) return { error: boardError.message, tasks: [] };

  const boardIds = (boards || []).map((b) => b.id);
  if (boardIds.length === 0) return { tasks: [] };

  const { data: tasks, error: taskError } = await supabase
    .from('tasks')
    .select('id, status, priority, assignee_id, updated_at')
    .in('board_id', boardIds);

  if (taskError) return { error: taskError.message, tasks: [] };
  return { tasks: tasks || [] };
}

async function loadWorkspaceTickets(workspaceId) {
  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('id, status, raised_by, assignee_id')
    .eq('workspace_id', workspaceId);

  if (error) {
    // Table may not exist yet if the tickets migration has not been applied.
    if (error.code === '42P01' || /tickets/i.test(error.message || '')) {
      return { tickets: [] };
    }
    return { error: error.message, tickets: [] };
  }
  return { tickets: tickets || [] };
}

function scopeTasks(tasks, userId, access, teamIds) {
  if (access.isAdmin) return tasks;
  if (access.isManager) {
    const team = new Set(teamIds);
    return tasks.filter((t) => !t.assignee_id || team.has(t.assignee_id));
  }
  return tasks.filter((t) => t.assignee_id === userId);
}

function scopeTickets(tickets, userId, access, teamIds) {
  if (access.isAdmin) return tickets;
  if (access.isManager) {
    const team = new Set(teamIds);
    return tickets.filter(
      (t) => team.has(t.raised_by) || (t.assignee_id && team.has(t.assignee_id))
    );
  }
  return tickets.filter((t) => t.raised_by === userId || t.assignee_id === userId);
}

export async function getWorkspaceReport(req, res) {
  const { workspaceId } = req.query;
  if (!workspaceId) {
    return res.status(400).json({ error: 'workspaceId query param is required' });
  }

  const access = await getWorkspaceAccess(req.user.id, workspaceId);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });

  const teamIds = access.isManager ? await getTeamUserIds(workspaceId, req.user.id) : [];

  const [taskResult, ticketResult] = await Promise.all([
    loadWorkspaceTasks(workspaceId),
    loadWorkspaceTickets(workspaceId),
  ]);

  if (taskResult.error) return res.status(500).json({ error: taskResult.error });
  if (ticketResult.error) return res.status(500).json({ error: ticketResult.error });

  const tasks = scopeTasks(taskResult.tasks, req.user.id, access, teamIds);
  const tickets = scopeTickets(ticketResult.tickets, req.user.id, access, teamIds);

  const tasksByStatus = emptyCounts(TASK_STATUSES);
  const tasksByPriority = emptyCounts(TASK_PRIORITIES);
  for (const task of tasks) {
    if (TASK_STATUSES.includes(task.status)) tasksByStatus[task.status] += 1;
    if (TASK_PRIORITIES.includes(task.priority)) tasksByPriority[task.priority] += 1;
  }

  const ticketsByStatus = emptyCounts(TICKET_STATUSES);
  for (const ticket of tickets) {
    if (TICKET_STATUSES.includes(ticket.status)) ticketsByStatus[ticket.status] += 1;
  }

  const dayKeys = last7DayKeys();
  const byDay = Object.fromEntries(dayKeys.map((d) => [d, 0]));
  for (const task of tasks) {
    if (task.status !== 'done' || !task.updated_at) continue;
    const key = dateKeyUTC(task.updated_at);
    if (key in byDay) byDay[key] += 1;
  }

  const scope = access.isAdmin ? 'workspace' : access.isManager ? 'team' : 'self';

  res.json({
    workspaceId,
    scope,
    tasksByStatus,
    tasksByPriority,
    ticketsByStatus,
    completionTrend: dayKeys.map((date) => ({ date, count: byDay[date] })),
  });
}
