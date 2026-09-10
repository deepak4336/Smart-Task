import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useWorkspace } from '../workspaces/WorkspaceContext';
import { api } from '../../lib/api';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import ExtractTasksModal from './ExtractTasksModal';

const COLUMNS = [
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'done', label: 'Done' },
];

export default function KanbanBoard() {
  const { boardId } = useParams();
  const { accessToken } = useAuth();
  const { setActiveWorkspaceId } = useWorkspace();

  const [board, setBoard] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState({ open: false, mode: 'create', task: null });
  const [extractOpen, setExtractOpen] = useState(false);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [cascadeNotice, setCascadeNotice] = useState(null);

  const loadBoard = useCallback(async () => {
    try {
      const data = await api.get(`/boards/${boardId}`, accessToken);
      setBoard(data.board);
      if (data.board?.workspace_id) setActiveWorkspaceId(data.board.workspace_id);
      return data.board;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, [boardId, accessToken, setActiveWorkspaceId]);

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

  const handleTaskSaved = async (result) => {
    await refresh();
    if (result?.rescheduled?.length) {
      setCascadeNotice(result.rescheduled);
    }
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
      <div className="board-main">
        <div className="board-header">
          <div>
            <Link to="/tasks" className="back-link">
              ← Boards
            </Link>
            <h2>{board?.name || 'Board'}</h2>
            {board?.project_name && (
              <p className="board-subtitle">{board.project_name}</p>
            )}
          </div>
          <div className="board-header-actions">
            <button type="button" className="btn-ghost" onClick={() => setExtractOpen(true)}>
              Extract from notes
            </button>
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              New task
            </button>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}
        {cascadeNotice && cascadeNotice.length > 0 && (
          <div className="form-info cascade-notice board-cascade-notice" role="status">
            <strong>
              {cascadeNotice.length} dependent {cascadeNotice.length === 1 ? 'task was' : 'tasks were'} also
              rescheduled
            </strong>
            <p>
              A predecessor moved later, so overlapping dependents were shifted by the same number of
              days.
            </p>
            <ul>
              {cascadeNotice.map((item) => (
                <li key={item.id}>
                  {item.title}: {item.previousDueDate} → {item.newDueDate}
                </li>
              ))}
            </ul>
            <button type="button" className="btn-ghost" onClick={() => setCascadeNotice(null)}>
              Dismiss
            </button>
          </div>
        )}

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
        boardTasks={tasks}
        members={members}
        accessToken={accessToken}
        onClose={closeModal}
        onSaved={handleTaskSaved}
        onDeleted={refresh}
      />

      <ExtractTasksModal
        open={extractOpen}
        boardId={boardId}
        members={members}
        accessToken={accessToken}
        onClose={() => setExtractOpen(false)}
        onSaved={refresh}
      />
    </div>
  );
}
