import { supabase } from '../config/supabaseClient.js';
import { assertTaskAccess } from './boardController.js';

const MAX_CASCADE_DEPTH = 10;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function dateOnly(value) {
  if (!value) return null;
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function dayDiff(fromDate, toDate) {
  const from = dateOnly(fromDate);
  const to = dateOnly(toDate);
  if (!from || !to) return 0;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / MS_PER_DAY);
}

function addDays(dateValue, days) {
  const from = dateOnly(dateValue);
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function loadTaskRow(taskId) {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, board_id, title, due_date, status')
    .eq('id', taskId)
    .single();
  if (error || !data) return null;
  return data;
}

/** True if adding taskId → dependsOnId would close a cycle. */
async function wouldCreateCycle(taskId, dependsOnId) {
  const visited = new Set();
  const queue = [dependsOnId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const { data: rows, error } = await supabase
      .from('task_dependencies')
      .select('depends_on_id')
      .eq('task_id', current);

    if (error) throw error;
    for (const row of rows || []) {
      if (!visited.has(row.depends_on_id)) queue.push(row.depends_on_id);
    }
  }

  return false;
}

/**
 * When a predecessor slips, shift dependents whose due dates now overlap
 * or precede the new date. Recurses through the chain, capped at MAX_CASCADE_DEPTH.
 */
export async function cascadeDependentDueDates(predecessor, previousDueDate, nextDueDate) {
  const shifted = [];
  const visited = new Set();
  const shiftDays = dayDiff(previousDueDate, nextDueDate);
  if (shiftDays <= 0) return shifted;

  async function walk(predId, predNewDue, depth) {
    if (depth > MAX_CASCADE_DEPTH) return;
    if (visited.has(predId)) return;
    visited.add(predId);

    const { data: links, error: linkError } = await supabase
      .from('task_dependencies')
      .select('task_id')
      .eq('depends_on_id', predId);

    if (linkError) throw linkError;
    const ids = [...new Set((links || []).map((l) => l.task_id))];
    if (ids.length === 0) return;

    const { data: dependents, error: taskError } = await supabase
      .from('tasks')
      .select('id, title, due_date')
      .in('id', ids);

    if (taskError) throw taskError;

    for (const dep of dependents || []) {
      const depDue = dateOnly(dep.due_date);
      const predDue = dateOnly(predNewDue);
      if (!depDue || !predDue) continue;
      if (depDue > predDue) continue;

      const newDue = addDays(depDue, shiftDays);
      const now = new Date().toISOString();
      const { data: updated, error: updateError } = await supabase
        .from('tasks')
        .update({ due_date: newDue, updated_at: now })
        .eq('id', dep.id)
        .select('id, title, due_date')
        .single();

      if (updateError) throw updateError;

      shifted.push({
        id: updated.id,
        title: updated.title,
        previousDueDate: depDue,
        newDueDate: dateOnly(updated.due_date),
        becauseOfTaskId: predId,
        shiftedByDays: shiftDays,
      });

      await walk(dep.id, newDue, depth + 1);
    }
  }

  await walk(predecessor.id, nextDueDate, 1);
  return shifted;
}

export async function listDependencies(req, res) {
  const { taskId } = req.params;
  const access = await assertTaskAccess(req.user.id, taskId);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });

  const [depsResult, dependentsResult] = await Promise.all([
    supabase
      .from('task_dependencies')
      .select('id, task_id, depends_on_id, created_at, depends_on:tasks!depends_on_id(id, title, due_date, status)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true }),
    supabase
      .from('task_dependencies')
      .select('id, task_id, depends_on_id, created_at, dependent:tasks!task_id(id, title, due_date, status)')
      .eq('depends_on_id', taskId)
      .order('created_at', { ascending: true }),
  ]);

  if (depsResult.error) return res.status(500).json({ error: depsResult.error.message });
  if (dependentsResult.error) return res.status(500).json({ error: dependentsResult.error.message });

  res.json({
    dependencies: depsResult.data || [],
    dependents: dependentsResult.data || [],
  });
}

export async function createDependency(req, res) {
  const { taskId } = req.params;
  const dependsOnId = req.body?.dependsOnId || req.body?.depends_on_id;

  if (!dependsOnId) {
    return res.status(400).json({ error: 'dependsOnId is required' });
  }
  if (taskId === dependsOnId) {
    return res.status(400).json({ error: 'A task cannot depend on itself' });
  }

  const access = await assertTaskAccess(req.user.id, taskId);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });

  const predecessorAccess = await assertTaskAccess(req.user.id, dependsOnId);
  if (predecessorAccess.error) {
    return res.status(predecessorAccess.error.status).json({
      error: predecessorAccess.error.status === 404
        ? 'Predecessor task not found'
        : predecessorAccess.error.message,
    });
  }

  const [task, predecessor] = await Promise.all([loadTaskRow(taskId), loadTaskRow(dependsOnId)]);
  if (!task || !predecessor) {
    return res.status(404).json({ error: 'Task not found' });
  }
  if (task.board_id !== predecessor.board_id) {
    return res.status(400).json({ error: 'Dependencies can only link tasks on the same board' });
  }

  try {
    if (await wouldCreateCycle(taskId, dependsOnId)) {
      return res.status(400).json({
        error: 'That link would create a circular dependency',
      });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const { data: link, error } = await supabase
    .from('task_dependencies')
    .insert({ task_id: taskId, depends_on_id: dependsOnId })
    .select('id, task_id, depends_on_id, created_at, depends_on:tasks!depends_on_id(id, title, due_date, status)')
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'This dependency already exists' });
    }
    if (error.code === '23514') {
      return res.status(400).json({ error: 'A task cannot depend on itself' });
    }
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json({ dependency: link });
}

export async function deleteDependency(req, res) {
  const { taskId, dependencyId } = req.params;

  const access = await assertTaskAccess(req.user.id, taskId);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });

  const { data: link, error: findError } = await supabase
    .from('task_dependencies')
    .select('id, task_id, depends_on_id')
    .eq('id', dependencyId)
    .maybeSingle();

  if (findError) return res.status(500).json({ error: findError.message });
  if (!link) return res.status(404).json({ error: 'Dependency not found' });

  const related = link.task_id === taskId || link.depends_on_id === taskId;
  if (!related) {
    return res.status(404).json({ error: 'Dependency not found' });
  }

  const otherTaskId = link.task_id === taskId ? link.depends_on_id : link.task_id;
  const otherAccess = await assertTaskAccess(req.user.id, otherTaskId);
  if (otherAccess.error) {
    return res.status(otherAccess.error.status).json({ error: otherAccess.error.message });
  }

  const { error } = await supabase.from('task_dependencies').delete().eq('id', dependencyId);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ message: 'Dependency removed' });
}
