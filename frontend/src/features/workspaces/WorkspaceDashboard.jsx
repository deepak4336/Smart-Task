import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useWorkspace } from './WorkspaceContext';
import { api } from '../../lib/api';

export default function WorkspaceDashboard() {
  const { accessToken } = useAuth();
  const { workspaces, refresh } = useWorkspace();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setError('');
    setCreating(true);
    try {
      await api.post('/workspaces', { name: newName }, accessToken);
      setNewName('');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="app-main">
      <h2>Dashboard</h2>
      <p className="page-lead">Your workspaces</p>

      <form onSubmit={handleCreate} className="create-bar">
        <input
          type="text"
          placeholder="New workspace name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={creating}>
          Create
        </button>
      </form>

      {error && <div className="form-error">{error}</div>}

      {workspaces.length === 0 ? (
        <div className="empty-state">No workspaces yet — create your first one above.</div>
      ) : (
        <ul className="workspace-list">
          {workspaces.map((ws) => (
            <li key={ws.id}>
              <Link to={`/workspaces/${ws.id}`} className="workspace-row workspace-row-link">
                {ws.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
