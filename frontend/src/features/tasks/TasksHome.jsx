import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useWorkspace } from '../workspaces/WorkspaceContext';
import { api } from '../../lib/api';

export default function TasksHome() {
  const { accessToken } = useAuth();
  const { workspaces, setActiveWorkspaceId } = useWorkspace();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');
      try {
        const next = await Promise.all(
          workspaces.map(async (ws) => {
            const projData = await api.get(`/workspaces/${ws.id}/projects`, accessToken);
            const projects = projData.projects || [];
            const boardsByProject = {};
            await Promise.all(
              projects.map(async (p) => {
                const b = await api.get(`/boards?projectId=${p.id}`, accessToken);
                boardsByProject[p.id] = b.boards || [];
              })
            );
            return { workspace: ws, projects, boardsByProject };
          })
        );
        if (!cancelled) setGroups(next);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, workspaces]);

  const hasBoards = groups.some((g) =>
    g.projects.some((p) => (g.boardsByProject[p.id] || []).length > 0)
  );

  return (
    <div className="app-main app-main-wide">
      <h2>Tasks</h2>
      <p className="page-lead">
        Open a board to manage tasks on the Kanban board.
      </p>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <p className="loading-state">Loading boards…</p>
      ) : workspaces.length === 0 ? (
        <div className="empty-state">
          Create a workspace on the Dashboard, then add a project and board.
        </div>
      ) : !hasBoards ? (
        <div className="empty-state">
          No boards yet.{' '}
          {workspaces[0] && (
            <Link to={`/workspaces/${workspaces[0].id}`}>Add a project and board</Link>
          )}
        </div>
      ) : (
        <div className="project-list">
          {groups.map(({ workspace, projects, boardsByProject }) => (
            <section key={workspace.id} className="project-block">
              <h3>{workspace.name}</h3>
              {projects.length === 0 ? (
                <p className="muted-note">No projects in this workspace.</p>
              ) : (
                projects.map((project) => (
                  <div key={project.id} className="task-home-project">
                    <p className="muted-note">{project.name}</p>
                    {(boardsByProject[project.id] || []).length === 0 ? (
                      <p className="muted-note">No boards yet.</p>
                    ) : (
                      <ul className="workspace-list">
                        {(boardsByProject[project.id] || []).map((board) => (
                          <li key={board.id}>
                            <Link
                              to={`/boards/${board.id}`}
                              className="workspace-row workspace-row-link"
                              onClick={() => setActiveWorkspaceId(workspace.id)}
                            >
                              {board.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
