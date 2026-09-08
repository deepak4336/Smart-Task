import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../lib/api';

export default function WorkspaceDetail() {
  const { workspaceId } = useParams();
  const { user, accessToken, signOut } = useAuth();

  const [projects, setProjects] = useState([]);
  const [boardsByProject, setBoardsByProject] = useState({});
  const [projectName, setProjectName] = useState('');
  const [boardName, setBoardName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const loadProjects = async () => {
    const data = await api.get(`/workspaces/${workspaceId}/projects`, accessToken);
    const list = data.projects || [];
    setProjects(list);

    const boardMap = {};
    await Promise.all(
      list.map(async (p) => {
        const b = await api.get(`/boards?projectId=${p.id}`, accessToken);
        boardMap[p.id] = b.boards || [];
      })
    );
    setBoardsByProject(boardMap);

    if (!selectedProjectId && list.length > 0) {
      setSelectedProjectId(list[0].id);
    }
  };

  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      setLoading(true);
      try {
        await loadProjects();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [accessToken, workspaceId]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    setError('');
    try {
      const data = await api.post(
        `/workspaces/${workspaceId}/projects`,
        { name: projectName },
        accessToken
      );
      setProjectName('');
      setSelectedProjectId(data.project.id);
      await loadProjects();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateBoard = async (e) => {
    e.preventDefault();
    if (!boardName.trim() || !selectedProjectId) return;
    setError('');
    try {
      await api.post(
        '/boards',
        { projectId: selectedProjectId, name: boardName },
        accessToken
      );
      setBoardName('');
      await loadProjects();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setError('');
    setInfo('');
    try {
      await api.post(
        `/workspaces/${workspaceId}/invite`,
        { email: inviteEmail },
        accessToken
      );
      setInviteEmail('');
      setInfo('Member invited.');
    } catch (err) {
      setError(err.message);
    }
  };

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

      <div className="app-main app-main-wide">
        <Link to="/" className="back-link">
          ← Workspaces
        </Link>
        <h2>Projects & boards</h2>

        {error && <div className="form-error">{error}</div>}
        {info && <div className="form-info">{info}</div>}

        <form onSubmit={handleInvite} className="create-bar">
          <input
            type="email"
            placeholder="Invite member by email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            Invite
          </button>
        </form>

        <form onSubmit={handleCreateProject} className="create-bar">
          <input
            type="text"
            placeholder="New project name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            Create project
          </button>
        </form>

        {projects.length > 0 && (
          <form onSubmit={handleCreateBoard} className="create-bar">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              aria-label="Project for new board"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="New board name"
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              Create board
            </button>
          </form>
        )}

        {loading ? (
          <p className="loading-state">Loading…</p>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            No projects yet — create one above, then add a board to open the Kanban view.
          </div>
        ) : (
          <div className="project-list">
            {projects.map((project) => (
              <section key={project.id} className="project-block">
                <h3>{project.name}</h3>
                {(boardsByProject[project.id] || []).length === 0 ? (
                  <p className="muted-note">No boards in this project yet.</p>
                ) : (
                  <ul className="workspace-list">
                    {(boardsByProject[project.id] || []).map((board) => (
                      <li key={board.id}>
                        <Link to={`/boards/${board.id}`} className="workspace-row workspace-row-link">
                          {board.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
