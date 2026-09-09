import { supabase } from '../config/supabaseClient.js';

const TASK_STATUSES = ['todo', 'in_progress', 'done'];
const OPEN_STATUSES = new Set(['todo', 'in_progress']);

function emptyStatusCounts() {
  return Object.fromEntries(TASK_STATUSES.map((k) => [k, 0]));
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

async function loadWorkspaceMembers(workspaceId) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('user_id, role, user:users!user_id(id, name, email)')
    .eq('workspace_id', workspaceId);

  if (error) return { error: error.message, members: [] };
  return { members: data || [] };
}

async function loadWorkspaceTasks(workspaceId) {
  const { data: projects, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('workspace_id', workspaceId);

  if (projectError) return { error: projectError.message, tasks: [], hasEstimatedHours: false };

  const projectIds = (projects || []).map((p) => p.id);
  if (projectIds.length === 0) return { tasks: [], hasEstimatedHours: true };

  const { data: boards, error: boardError } = await supabase
    .from('boards')
    .select('id, project_id')
    .in('project_id', projectIds);

  if (boardError) return { error: boardError.message, tasks: [], hasEstimatedHours: false };

  const boardList = boards || [];
  if (boardList.length === 0) return { tasks: [], hasEstimatedHours: true };

  const boardIds = boardList.map((b) => b.id);
  const projectByBoard = Object.fromEntries(boardList.map((b) => [b.id, b.project_id]));

  let hasEstimatedHours = true;
  let { data: tasks, error: taskError } = await supabase
    .from('tasks')
    .select('id, status, assignee_id, estimated_hours, board_id')
    .in('board_id', boardIds);

  if (taskError && /estimated_hours/i.test(taskError.message || '')) {
    hasEstimatedHours = false;
    const retry = await supabase
      .from('tasks')
      .select('id, status, assignee_id, board_id')
      .in('board_id', boardIds);
    tasks = retry.data;
    taskError = retry.error;
  }

  if (taskError) return { error: taskError.message, tasks: [], hasEstimatedHours: false };

  return {
    hasEstimatedHours,
    tasks: (tasks || []).map((t) => ({
      ...t,
      project_id: projectByBoard[t.board_id],
    })),
  };
}

function teamProjectIdsForManager(tasks, managerId) {
  const ids = new Set();
  for (const task of tasks) {
    if (task.assignee_id === managerId && task.project_id) ids.add(task.project_id);
  }
  return ids;
}

function scopedPeople(members, tasks, userId, access) {
  if (access.isAdmin) {
    return members;
  }

  if (access.isManager) {
    const teamProjects = teamProjectIdsForManager(tasks, userId);
    const teamIds = new Set([userId]);

    if (teamProjects.size > 0) {
      for (const task of tasks) {
        if (task.assignee_id && teamProjects.has(task.project_id)) {
          teamIds.add(task.assignee_id);
        }
      }
    } else {
      for (const m of members) {
        if (m.role === 'member') teamIds.add(m.user_id);
      }
    }

    return members.filter((m) => teamIds.has(m.user_id));
  }

  return members.filter((m) => m.user_id === userId);
}

function personWorkload(member, tasks, hasEstimatedHours) {
  const assigned = tasks.filter((t) => t.assignee_id === member.user_id);
  const tasksByStatus = emptyStatusCounts();
  let openCount = 0;
  let hourSum = 0;

  for (const task of assigned) {
    if (TASK_STATUSES.includes(task.status)) tasksByStatus[task.status] += 1;
    if (!OPEN_STATUSES.has(task.status)) continue;
    openCount += 1;
    if (hasEstimatedHours) {
      const hours = Number(task.estimated_hours);
      hourSum += Number.isFinite(hours) ? hours : 0;
    }
  }

  return {
    userId: member.user_id,
    name: member.user?.name || member.user?.email || 'Unknown',
    role: member.role,
    totalTasks: assigned.length,
    tasksByStatus,
    openTasks: openCount,
    effort: hasEstimatedHours ? hourSum : openCount,
  };
}

export async function getWorkspaceWorkload(req, res) {
  const { workspaceId } = req.query;
  if (!workspaceId) {
    return res.status(400).json({ error: 'workspaceId query param is required' });
  }

  const access = await getWorkspaceAccess(req.user.id, workspaceId);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });

  const [memberResult, taskResult] = await Promise.all([
    loadWorkspaceMembers(workspaceId),
    loadWorkspaceTasks(workspaceId),
  ]);

  if (memberResult.error) return res.status(500).json({ error: memberResult.error });
  if (taskResult.error) return res.status(500).json({ error: taskResult.error });

  const peopleInScope = scopedPeople(
    memberResult.members,
    taskResult.tasks,
    req.user.id,
    access
  );

  const people = peopleInScope
    .map((m) => personWorkload(m, taskResult.tasks, taskResult.hasEstimatedHours))
    .sort((a, b) => b.effort - a.effort || a.name.localeCompare(b.name));

  const scope = access.isAdmin ? 'workspace' : access.isManager ? 'team' : 'self';

  res.json({
    workspaceId,
    scope,
    effortMetric: taskResult.hasEstimatedHours ? 'estimated_hours' : 'open_task_count',
    people,
  });
}
