import { supabase } from '../config/supabaseClient.js';

const ALLOWED_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const ALLOWED_PRIORITIES = ['low', 'medium', 'high'];

const TICKET_SELECT =
  '*, raiser:users!raised_by(id, name, email), assignee:users!assignee_id(id, name, email)';

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

function canUpdateTicket(userId, ticket, access) {
  return (
    ticket.raised_by === userId ||
    ticket.assignee_id === userId ||
    access.isAdmin ||
    access.isManager
  );
}

function withPermissions(ticket, userId, access) {
  return {
    ...ticket,
    canUpdate: canUpdateTicket(userId, ticket, access),
  };
}

/**
 * Team Leader scope: tickets raised by or assigned to people on their
 * team's projects (task assignees in this workspace) plus workspace employees
 * (role member) and themselves.
 */
async function getTeamUserIds(workspaceId, managerId) {
  const ids = new Set([managerId]);

  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', workspaceId);

  for (const m of members || []) {
    if (m.role === 'member') ids.add(m.user_id);
  }

  const { data: projects } = await supabase
    .from('projects')
    .select('id')
    .eq('workspace_id', workspaceId);

  const projectIds = (projects || []).map((p) => p.id);
  if (projectIds.length === 0) return [...ids];

  const { data: boards } = await supabase.from('boards').select('id').in('project_id', projectIds);
  const boardIds = (boards || []).map((b) => b.id);
  if (boardIds.length === 0) return [...ids];

  const { data: tasks } = await supabase
    .from('tasks')
    .select('assignee_id')
    .in('board_id', boardIds);

  for (const t of tasks || []) {
    if (t.assignee_id) ids.add(t.assignee_id);
  }

  return [...ids];
}

async function loadTicket(ticketId) {
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select(TICKET_SELECT)
    .eq('id', ticketId)
    .maybeSingle();

  if (error) return { error: { status: 500, message: error.message } };
  if (!ticket) return { error: { status: 404, message: 'Ticket not found' } };
  return { ticket };
}

async function assertAssigneeInWorkspace(workspaceId, assigneeId) {
  if (!assigneeId) return null;
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', assigneeId)
    .maybeSingle();

  if (!membership) {
    return { status: 400, message: 'Assignee must be a member of this workspace' };
  }
  return null;
}

export async function listTickets(req, res) {
  const { workspaceId } = req.query;
  if (!workspaceId) {
    return res.status(400).json({ error: 'workspaceId query param is required' });
  }

  const access = await getWorkspaceAccess(req.user.id, workspaceId);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });

  const { data: tickets, error } = await supabase
    .from('tickets')
    .select(TICKET_SELECT)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  let scoped = tickets || [];
  if (access.isAdmin) {
    // Admin sees every ticket in the workspace
  } else if (access.isManager) {
    const teamIds = new Set(await getTeamUserIds(workspaceId, req.user.id));
    scoped = scoped.filter(
      (t) => teamIds.has(t.raised_by) || (t.assignee_id && teamIds.has(t.assignee_id))
    );
  } else {
    scoped = scoped.filter(
      (t) => t.raised_by === req.user.id || t.assignee_id === req.user.id
    );
  }

  res.json({
    tickets: scoped.map((t) => withPermissions(t, req.user.id, access)),
  });
}

export async function createTicket(req, res) {
  const { workspaceId, title, description = null, priority = 'medium', assigneeId = null } = req.body;

  if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });
  if (!title || !String(title).trim()) return res.status(400).json({ error: 'Title is required' });
  if (!ALLOWED_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: `priority must be one of: ${ALLOWED_PRIORITIES.join(', ')}` });
  }

  const access = await getWorkspaceAccess(req.user.id, workspaceId);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });

  const assigneeError = await assertAssigneeInWorkspace(workspaceId, assigneeId);
  if (assigneeError) return res.status(assigneeError.status).json({ error: assigneeError.message });

  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      workspace_id: workspaceId,
      raised_by: req.user.id,
      assignee_id: assigneeId || null,
      title: String(title).trim(),
      description: description?.trim() || null,
      status: 'open',
      priority,
    })
    .select(TICKET_SELECT)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ ticket: withPermissions(ticket, req.user.id, access) });
}

export async function getTicket(req, res) {
  const { ticketId } = req.params;
  const loaded = await loadTicket(ticketId);
  if (loaded.error) return res.status(loaded.error.status).json({ error: loaded.error.message });

  const access = await getWorkspaceAccess(req.user.id, loaded.ticket.workspace_id);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });

  if (!access.isAdmin) {
    if (access.isManager) {
      const teamIds = await getTeamUserIds(loaded.ticket.workspace_id, req.user.id);
      const inTeam =
        teamIds.includes(loaded.ticket.raised_by) ||
        (loaded.ticket.assignee_id && teamIds.includes(loaded.ticket.assignee_id));
      if (!inTeam) return res.status(403).json({ error: 'Not allowed to view this ticket' });
    } else {
      const mine =
        loaded.ticket.raised_by === req.user.id || loaded.ticket.assignee_id === req.user.id;
      if (!mine) return res.status(403).json({ error: 'Not allowed to view this ticket' });
    }
  }

  res.json({ ticket: withPermissions(loaded.ticket, req.user.id, access) });
}

export async function updateTicket(req, res) {
  const { ticketId } = req.params;
  const { status, priority, assigneeId } = req.body;

  const loaded = await loadTicket(ticketId);
  if (loaded.error) return res.status(loaded.error.status).json({ error: loaded.error.message });

  const access = await getWorkspaceAccess(req.user.id, loaded.ticket.workspace_id);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });

  if (!canUpdateTicket(req.user.id, loaded.ticket, access)) {
    return res.status(403).json({ error: 'Not allowed to update this ticket' });
  }

  const updates = { updated_at: new Date().toISOString() };

  if (status !== undefined) {
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` });
    }
    updates.status = status;
  }
  if (priority !== undefined) {
    if (!ALLOWED_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `priority must be one of: ${ALLOWED_PRIORITIES.join(', ')}` });
    }
    updates.priority = priority;
  }
  if (assigneeId !== undefined) {
    const assigneeError = await assertAssigneeInWorkspace(
      loaded.ticket.workspace_id,
      assigneeId || null
    );
    if (assigneeError) return res.status(assigneeError.status).json({ error: assigneeError.message });
    updates.assignee_id = assigneeId || null;
  }

  if (Object.keys(updates).length === 1) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const { data: ticket, error } = await supabase
    .from('tickets')
    .update(updates)
    .eq('id', ticketId)
    .select(TICKET_SELECT)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ticket: withPermissions(ticket, req.user.id, access) });
}

export async function deleteTicket(req, res) {
  const { ticketId } = req.params;

  const loaded = await loadTicket(ticketId);
  if (loaded.error) return res.status(loaded.error.status).json({ error: loaded.error.message });

  const access = await getWorkspaceAccess(req.user.id, loaded.ticket.workspace_id);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });

  const allowed =
    loaded.ticket.raised_by === req.user.id || access.isAdmin || access.isManager;
  if (!allowed) return res.status(403).json({ error: 'Not allowed to delete this ticket' });

  const { error } = await supabase.from('tickets').delete().eq('id', ticketId);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ message: 'Ticket deleted' });
}
