import { supabase } from '../config/supabaseClient.js';
import { assertBoardAccess, assertTaskAccess } from './boardController.js';
import { cascadeDependentDueDates } from './dependencyController.js';
import { createNotification } from './notificationController.js';

const ALLOWED_STATUSES = ['todo', 'in_progress', 'done'];
const ALLOWED_PRIORITIES = ['low', 'medium', 'high'];

export async function listTasks(req, res) {
  const { boardId } = req.query;
  if (!boardId) return res.status(400).json({ error: 'boardId query param is required' });

  const access = await assertBoardAccess(req.user.id, boardId);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*, assignee:users!assignee_id(id, name, email)')
    .eq('board_id', boardId)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ tasks });
}

export async function createTask(req, res) {
  const {
    boardId,
    title,
    description = null,
    status = 'todo',
    priority = 'medium',
    assigneeId = null,
    dueDate = null,
    estimatedHours = 1,
  } = req.body;

  if (!boardId) return res.status(400).json({ error: 'boardId is required' });
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` });
  }
  if (!ALLOWED_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: `priority must be one of: ${ALLOWED_PRIORITIES.join(', ')}` });
  }

  const access = await assertBoardAccess(req.user.id, boardId);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      board_id: boardId,
      title: title.trim(),
      description: description?.trim() || null,
      status,
      priority,
      assignee_id: assigneeId || null,
      due_date: dueDate || null,
      estimated_hours: estimatedHours ?? 1,
    })
    .select('*, assignee:users!assignee_id(id, name, email)')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  if (task.assignee_id && task.assignee_id !== req.user.id) {
    await createNotification({
      userId: task.assignee_id,
      type: 'assigned',
      message: `You were assigned to "${task.title}"`,
      taskId: task.id,
    });
  }

  res.status(201).json({ task });
}

export async function getTask(req, res) {
  const { taskId } = req.params;

  const access = await assertTaskAccess(req.user.id, taskId);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });

  const { data: task, error } = await supabase
    .from('tasks')
    .select('*, assignee:users!assignee_id(id, name, email)')
    .eq('id', taskId)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ task });
}

export async function updateTask(req, res) {
  const { taskId } = req.params;
  const { title, description, status, priority, assigneeId, dueDate, estimatedHours } = req.body;

  const access = await assertTaskAccess(req.user.id, taskId);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });

  const updates = { updated_at: new Date().toISOString() };

  if (title !== undefined) {
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Title cannot be empty' });
    }
    updates.title = String(title).trim();
  }
  if (description !== undefined) updates.description = description?.trim() || null;
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
  if (assigneeId !== undefined) updates.assignee_id = assigneeId || null;
  if (dueDate !== undefined) updates.due_date = dueDate || null;
  if (estimatedHours !== undefined) updates.estimated_hours = estimatedHours;

  const previousDueDate = access.task.due_date;
  const previousAssigneeId = access.task.assignee_id;

  const { data: task, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .select('*, assignee:users!assignee_id(id, name, email)')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  if (
    assigneeId !== undefined &&
    task.assignee_id &&
    task.assignee_id !== previousAssigneeId &&
    task.assignee_id !== req.user.id
  ) {
    await createNotification({
      userId: task.assignee_id,
      type: 'assigned',
      message: `You were assigned to "${task.title}"`,
      taskId: task.id,
    });
  }

  let rescheduled = [];
  if (dueDate !== undefined && previousDueDate && task.due_date) {
    const prev = String(previousDueDate).slice(0, 10);
    const next = String(task.due_date).slice(0, 10);
    if (next > prev) {
      try {
        rescheduled = await cascadeDependentDueDates(task, prev, next);
      } catch (cascadeError) {
        return res.status(500).json({ error: cascadeError.message });
      }
    }
  }

  res.json({ task, rescheduled });
}

export async function deleteTask(req, res) {
  const { taskId } = req.params;

  const access = await assertTaskAccess(req.user.id, taskId);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });

  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ message: 'Task deleted' });
}

export async function listComments(req, res) {
  const { taskId } = req.params;

  const access = await assertTaskAccess(req.user.id, taskId);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });

  const { data: comments, error } = await supabase
    .from('comments')
    .select('*, author:users!user_id(id, name, email)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ comments });
}

export async function addComment(req, res) {
  const { taskId } = req.params;
  const { text } = req.body;

  if (!text || !text.trim()) return res.status(400).json({ error: 'Comment text is required' });

  const access = await assertTaskAccess(req.user.id, taskId);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });

  const { data: comment, error } = await supabase
    .from('comments')
    .insert({ task_id: taskId, user_id: req.user.id, text: text.trim() })
    .select('*, author:users!user_id(id, name, email)')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const assigneeId = access.task.assignee_id;
  if (assigneeId && assigneeId !== req.user.id) {
    const authorName = comment.author?.name || 'Someone';
    await createNotification({
      userId: assigneeId,
      type: 'comment',
      message: `${authorName} commented on "${access.task.title}"`,
      taskId,
    });
  }

  res.status(201).json({ comment });
}
