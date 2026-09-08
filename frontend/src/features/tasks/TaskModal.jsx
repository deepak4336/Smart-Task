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

export default function TaskModal({
  open,
  mode, // 'create' | 'edit'
  boardId,
  task,
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

  useEffect(() => {
    if (!open) return;
    setError('');
    setCommentText('');

    if (mode === 'edit' && task) {
      setForm({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'todo',
        priority: task.priority || 'medium',
        assigneeId: task.assignee_id || task.assignee?.id || '',
        dueDate: task.due_date || '',
      });
      loadComments(task.id);
    } else {
      setForm(emptyForm);
      setComments([]);
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
        await api.post('/tasks', { boardId, ...payload }, accessToken);
      } else {
        await api.patch(`/tasks/${task.id}`, payload, accessToken);
      }
      onSaved();
      onClose();
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
