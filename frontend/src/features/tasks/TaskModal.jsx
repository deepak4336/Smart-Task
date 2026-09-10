import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const emptyForm = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  assigneeId: '',
  dueDate: '',
};

const STATUS_LABEL = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };

function formatDue(value) {
  if (!value) return 'No due date';
  return String(value).slice(0, 10);
}

export default function TaskModal({
  open,
  mode, // 'create' | 'edit'
  boardId,
  task,
  boardTasks = [],
  members,
  accessToken,
  onClose,
  onSaved,
  onDeleted,
}) {
  const [form, setForm] = useState(emptyForm);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [cascadeNotice, setCascadeNotice] = useState(null);
  const [dependencies, setDependencies] = useState([]);
  const [dependents, setDependents] = useState([]);
  const [depQuery, setDepQuery] = useState('');
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setCommentText('');
    setCascadeNotice(null);
    setDepQuery('');

    if (mode === 'edit' && task) {
      setForm({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'todo',
        priority: task.priority || 'medium',
        assigneeId: task.assignee_id || task.assignee?.id || '',
        dueDate: task.due_date ? String(task.due_date).slice(0, 10) : '',
      });
      loadComments(task.id);
      loadDependencies(task.id);
    } else {
      setForm(emptyForm);
      setComments([]);
      setDependencies([]);
      setDependents([]);
    }
  }, [open, mode, task]);

  const loadComments = async (taskId) => {
    try {
      const data = await api.get(`/tasks/${taskId}/comments`, accessToken);
      setComments(data.comments || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadDependencies = async (taskId) => {
    try {
      const data = await api.get(`/tasks/${taskId}/dependencies`, accessToken);
      setDependencies(data.dependencies || []);
      setDependents(data.dependents || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError('');

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      priority: form.priority,
      assigneeId: form.assigneeId || null,
      dueDate: form.dueDate || null,
    };

    try {
      if (mode === 'create') {
        const data = await api.post('/tasks', { boardId, ...payload }, accessToken);
        onSaved(data);
        onClose();
      } else {
        const data = await api.patch(`/tasks/${task.id}`, payload, accessToken);
        const shifted = data.rescheduled || [];
        onSaved(data);
        if (shifted.length > 0) {
          setCascadeNotice(shifted);
        } else {
          onClose();
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task || !window.confirm('Delete this task?')) return;
    setSaving(true);
    try {
      await api.delete(`/tasks/${task.id}`, accessToken);
      onDeleted();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const linkedPredecessorIds = new Set(dependencies.map((d) => d.depends_on_id));
  const candidateTasks = boardTasks.filter((t) => {
    if (!task || t.id === task.id) return false;
    if (linkedPredecessorIds.has(t.id)) return false;
    const q = depQuery.trim().toLowerCase();
    if (!q) return true;
    return (t.title || '').toLowerCase().includes(q);
  });

  const handleLinkDependency = async (dependsOnId) => {
    if (!task || !dependsOnId) return;
    setLinking(true);
    setError('');
    try {
      await api.post(`/tasks/${task.id}/dependencies`, { dependsOnId }, accessToken);
      setDepQuery('');
      await loadDependencies(task.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLinking(false);
    }
  };

  const handleRemoveDependency = async (linkId) => {
    if (!task) return;
    setLinking(true);
    setError('');
    try {
      await api.delete(`/tasks/${task.id}/dependencies/${linkId}`, accessToken);
      await loadDependencies(task.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLinking(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !task) return;
    try {
      await api.post(`/tasks/${task.id}/comments`, { text: commentText }, accessToken);
      setCommentText('');
      loadComments(task.id);
    } catch (err) {
      setError(err.message);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{mode === 'create' ? 'New task' : 'Edit task'}</h3>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}
        {cascadeNotice && cascadeNotice.length > 0 && (
          <div className="form-info cascade-notice" role="status">
            <strong>
              {cascadeNotice.length} dependent {cascadeNotice.length === 1 ? 'task was' : 'tasks were'} also
              rescheduled
            </strong>
            <p>
              This task&apos;s due date moved later, so dependent tasks that would now overlap or
              finish too early were shifted by the same number of days.
            </p>
            <ul>
              {cascadeNotice.map((item) => (
                <li key={item.id}>
                  {item.title}: {item.previousDueDate} → {item.newDueDate}
                </li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="task-title">Title</label>
            <input
              id="task-title"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="task-desc">Description</label>
            <textarea
              id="task-desc"
              rows={3}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="task-status">Status</label>
              <select
                id="task-status"
                value={form.status}
                onChange={(e) => setField('status', e.target.value)}
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="task-priority">Priority</label>
              <select
                id="task-priority"
                value={form.priority}
                onChange={(e) => setField('priority', e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="task-assignee">Assignee</label>
              <select
                id="task-assignee"
                value={form.assigneeId}
                onChange={(e) => setField('assigneeId', e.target.value)}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name || m.user.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="task-due">Due date</label>
              <input
                id="task-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => setField('dueDate', e.target.value)}
              />
            </div>
          </div>

          <div className="modal-actions">
            {mode === 'edit' && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={saving}
              >
                Delete
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : mode === 'create' ? 'Create task' : 'Save changes'}
            </button>
          </div>
        </form>

        {mode === 'edit' && task && (
          <div className="comments-section">
            <h4>Depends on</h4>
            <p className="comments-empty">
              This task waits on the tasks below. Delaying a predecessor can push dependent dates
              forward.
            </p>
            {dependencies.length === 0 ? (
              <p className="comments-empty">No dependencies yet.</p>
            ) : (
              <ul className="dep-list">
                {dependencies.map((link) => (
                  <li key={link.id} className="dep-item">
                    <div>
                      <div className="dep-title">{link.depends_on?.title || 'Task'}</div>
                      <div className="dep-meta">
                        {STATUS_LABEL[link.depends_on?.status] || link.depends_on?.status} ·{' '}
                        {formatDue(link.depends_on?.due_date)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-ghost dep-remove"
                      onClick={() => handleRemoveDependency(link.id)}
                      disabled={linking}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <label className="field-label-inline" htmlFor="dep-search">
              Add a dependency
            </label>
            <input
              id="dep-search"
              type="search"
              placeholder="Search tasks on this board…"
              value={depQuery}
              onChange={(e) => setDepQuery(e.target.value)}
              disabled={linking}
            />
            {candidateTasks.length === 0 ? (
              <p className="comments-empty">
                {boardTasks.length <= 1
                  ? 'Add another task on this board to link a dependency.'
                  : depQuery
                    ? 'No matching tasks.'
                    : 'All other tasks on this board are already linked.'}
              </p>
            ) : (
              <ul className="dep-picker">
                {candidateTasks.slice(0, 8).map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className="dep-picker-btn"
                      disabled={linking}
                      onClick={() => handleLinkDependency(t.id)}
                    >
                      <span>{t.title}</span>
                      <span className="dep-meta">{formatDue(t.due_date)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <h4 className="dep-subhead">Blocked by this task</h4>
            {dependents.length === 0 ? (
              <p className="comments-empty">Nothing depends on this task.</p>
            ) : (
              <ul className="dep-list">
                {dependents.map((link) => (
                  <li key={link.id} className="dep-item">
                    <div>
                      <div className="dep-title">{link.dependent?.title || 'Task'}</div>
                      <div className="dep-meta">
                        {STATUS_LABEL[link.dependent?.status] || link.dependent?.status} ·{' '}
                        {formatDue(link.dependent?.due_date)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-ghost dep-remove"
                      onClick={() => handleRemoveDependency(link.id)}
                      disabled={linking}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {mode === 'edit' && task && (
          <div className="comments-section">
            <h4>Comments</h4>
            {comments.length === 0 ? (
              <p className="comments-empty">No comments yet.</p>
            ) : (
              <ul className="comment-list">
                {comments.map((c) => (
                  <li key={c.id} className="comment-item">
                    <div className="comment-author">
                      {c.author?.name || c.author?.email || 'Member'}
                    </div>
                    <div className="comment-text">{c.text}</div>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={handleAddComment} className="comment-form">
              <input
                type="text"
                placeholder="Add a comment…"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                Post
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
