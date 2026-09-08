import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../lib/api';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';

const COLUMNS = [
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'done', label: 'Done' },
];

export default function KanbanBoard() {
  const { boardId } = useParams();
  const { user, accessToken, signOut } = useAuth();

  const [board, setBoard] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState({ open: false, mode: 'create', task: null });
  const [dragOverCol, setDragOverCol] = useState(null);

  const loadBoard = useCallback(async () => {
    try {
      const data = await api.get(`/boards/${boardId}`, accessToken);
      setBoard(data.board);
      return data.board;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, [boardId, accessToken]);

  const loadTasks = useCallback(async () => {
    try {
      const data = await api.get(`/tasks?boardId=${boardId}`, accessToken);
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err.message);
    }
  }, [boardId, accessToken]);

  const loadMembers = useCallback(
    async (workspaceId) => {
      if (!workspaceId) return;
      try {
        const data = await api.get(`/workspaces/${workspaceId}/members`, accessToken);
        setMembers(data.members || []);
      } catch (err) {
        setError(err.message);
      }
    },
    [accessToken]
  );

  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      setLoading(true);
      const b = await loadBoard();
      await loadTasks();
      if (b?.workspace_id) await loadMembers(b.workspace_id);
      setLoading(false);
    })();
  }, [accessToken, loadBoard, loadTasks, loadMembers]);

  const refresh = async () => {
    await loadTasks();
  };

  const handleDragStart = (e, task) => {
    e.dataTransfer.setData('text/task-id', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(columnId);
  };

  const handleDrop = async (e, status) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData('text/task-id');
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === status) return;

    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));

    try {
      await api.patch(`/tasks/${taskId}`, { status }, accessToken);
    } catch (err) {
      setError(err.message);
      await loadTasks();
    }
  };

  const openCreate = () => setModal({ open: true, mode: 'create', task: null });
  const openEdit = (task) => setModal({ open: true, mode: 'edit', task });
  const closeModal = () => setModal({ open: false, mode: 'create', task: null });

  return (
    <div>
      <div className="app-topbar">
        <Link to="/" className="wordmark">
          <span className="wordmark-tag" />
          SmartTask
        </Link>
        <div className="user-chip">
          <span className="user-email">{user?.email}</span>
          <button className="btn-ghost" onClick={signOut}>
            Log out
          </button>
        </div>
      </div>

      <div className="board-main">
        <div className="board-header">
          <div>
            <Link to={board?.workspace_id ? `/workspaces/${board.workspace_id}` : '/'} className="back-link">
              ← Back
            </Link>
            <h2>{board?.name || 'Board'}</h2>
            {board?.project_name && (
              <p className="board-subtitle">{board.project_name}</p>
            )}
          </div>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            New task
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        {loading ? (
          <p className="loading-state">Loading board…</p>
        ) : (
          <div className="kanban-columns">
            {COLUMNS.map((col) => {
              const colTasks = tasks.filter((t) => t.status === col.id);
              return (
                <section
                  key={col.id}
                  className={`kanban-column${dragOverCol === col.id ? ' is-drop-target' : ''}`}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={(e) => handleDrop(e, col.id)}
                >
                  <header className="kanban-column-header">
                    <h3>{col.label}</h3>
                    <span className="kanban-count">{colTasks.length}</span>
                  </header>
                  <div className="kanban-column-body">
                    {colTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onOpen={openEdit}
                        onDragStart={handleDragStart}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <TaskModal
        open={modal.open}
        mode={modal.mode}
        boardId={boardId}
        task={modal.task}
        members={members}
        accessToken={accessToken}
        onClose={closeModal}
        onSaved={refresh}
        onDeleted={refresh}
      />
    </div>
  );
}
