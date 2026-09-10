import { supabase } from '../config/supabaseClient.js';
import { assertBoardAccess } from './boardController.js';
import { extractActionItems } from '../services/groqClient.js';

const ALLOWED_STATUSES = ['todo', 'in_progress', 'done'];
const ALLOWED_PRIORITIES = ['low', 'medium', 'high'];

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function matchAssignee(suggestedName, members) {
  const needle = normalizeName(suggestedName);
  if (!needle || needle.length < 2) {
    return { assigneeId: null, assigneeName: null, matchConfidence: 'none' };
  }

  const scored = members
    .map((m) => {
      const user = m.user;
      if (!user) return null;
      const name = normalizeName(user.name);
      const emailLocal = normalizeName((user.email || '').split('@')[0]);
      let score = 0;
      if (name && name === needle) score = 100;
      else if (emailLocal && emailLocal === needle) score = 90;
      else if (name && (name.startsWith(needle) || needle.startsWith(name)) && Math.min(name.length, needle.length) >= 3) {
        score = 85;
      } else if (name && (name.includes(needle) || needle.includes(name)) && Math.min(name.length, needle.length) >= 4) {
        score = 72;
      } else {
        const first = name.split(' ')[0];
        const needleFirst = needle.split(' ')[0];
        if (first && needleFirst && first === needleFirst && first.length >= 3) score = 70;
      }
      return { user, score };
    })
    .filter((row) => row && row.score >= 85)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { assigneeId: null, assigneeName: null, matchConfidence: 'none' };
  }
  if (scored.length > 1 && scored[0].score === scored[1].score) {
    return { assigneeId: null, assigneeName: null, matchConfidence: 'ambiguous' };
  }

  return {
    assigneeId: scored[0].user.id,
    assigneeName: scored[0].user.name || scored[0].user.email,
    matchConfidence: 'high',
  };
}

async function loadWorkspaceMembers(workspaceId) {
  const { data: members, error } = await supabase
    .from('workspace_members')
    .select('user:users!user_id(id, name, email)')
    .eq('workspace_id', workspaceId);

  if (error) throw error;
  return members || [];
}

export async function extractFromNotes(req, res) {
  const { notes, boardId } = req.body || {};

  if (!boardId) return res.status(400).json({ error: 'boardId is required' });
  if (!notes || !String(notes).trim()) {
    return res.status(400).json({ error: 'notes is required' });
  }

  const access = await assertBoardAccess(req.user.id, boardId);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });

  try {
    const members = await loadWorkspaceMembers(access.workspaceId);
    const { suggestions, cached } = await extractActionItems(notes);
    const matched = suggestions.map((item) => {
      const match = matchAssignee(item.suggestedAssigneeName, members);
      return {
        title: item.title,
        suggestedDueDate: item.suggestedDueDate,
        suggestedAssigneeName: item.suggestedAssigneeName,
        assigneeId: match.assigneeId,
        assigneeName: match.assigneeName,
        matchConfidence: match.matchConfidence,
      };
    });

    res.json({ suggestions: matched, cached });
  } catch (err) {
    if (err.code === 'VALIDATION') return res.status(400).json({ error: err.message });
    if (err.code === 'CONFIG') return res.status(503).json({ error: err.message });
    if (err.code === 'INVALID_JSON') return res.status(502).json({ error: err.message });
    console.error('extractFromNotes:', err.message);
    return res.status(502).json({ error: err.message || 'Failed to extract tasks from notes.' });
  }
}

export async function confirmExtractedTasks(req, res) {
  const { boardId, tasks } = req.body || {};

  if (!boardId) return res.status(400).json({ error: 'boardId is required' });
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ error: 'tasks must be a non-empty array' });
  }
  if (tasks.length > 25) {
    return res.status(400).json({ error: 'You can add at most 25 tasks at once' });
  }

  const access = await assertBoardAccess(req.user.id, boardId);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });

  let members;
  try {
    members = await loadWorkspaceMembers(access.workspaceId);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const memberIds = new Set(members.map((m) => m.user?.id).filter(Boolean));
  const rows = [];

  for (const item of tasks) {
    const title = String(item?.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Each task needs a title' });

    const status = item.status || 'todo';
    const priority = item.priority || 'medium';
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` });
    }
    if (!ALLOWED_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `priority must be one of: ${ALLOWED_PRIORITIES.join(', ')}` });
    }

    const assigneeId = item.assigneeId || null;
    if (assigneeId && !memberIds.has(assigneeId)) {
      return res.status(400).json({ error: `Assignee is not a member of this workspace: ${title}` });
    }

    const dueDate = item.dueDate || item.suggestedDueDate || null;

    rows.push({
      board_id: boardId,
      title: title.slice(0, 200),
      description: item.description?.trim() || null,
      status,
      priority,
      assignee_id: assigneeId,
      due_date: dueDate || null,
      estimated_hours: item.estimatedHours ?? 1,
    });
  }

  const { data: created, error } = await supabase
    .from('tasks')
    .insert(rows)
    .select('*, assignee:users!assignee_id(id, name, email)');

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ tasks: created });
}
