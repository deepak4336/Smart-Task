import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../lib/api';

export default function WorkspaceDashboard() {
  const { user, accessToken, signOut } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadWorkspaces = async () => {
    try {
      const data = await api.get('/workspaces', accessToken);
      setWorkspaces(data.workspaces || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) loadWorkspaces();
  }, [accessToken]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await api.post('/workspaces', { name: newName }, accessToken);
      setNewName('');
      loadWorkspaces();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="app-topbar">
        <span className="wordmark">
          <span className="wordmark-tag" />
          SmartTask
        </span>
        <div className="user-chip">
          <span className="user-email">{user?.email}</span>
          <button className="btn-ghost" onClick={signOut}>
            Log out
          </button>
        </div>
      </div>

      <div className="app-main">
        <h2>Your workspaces</h2>

        <form onSubmit={handleCreate} className="create-bar">
          <input
            type="text"
            placeholder="New workspace name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            Create
          </button>
        </form>

        {error && <div className="form-error">{error}</div>}

        {loading ? (
          <p className="loading-state">Loading workspaces…</p>
        ) : workspaces.length === 0 ? (
          <div className="empty-state">No workspaces yet — create your first one above.</div>
        ) : (
          <ul className="workspace-list">
            {workspaces.map((ws) => (
              <li key={ws.id} className="workspace-row">
                {ws.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
