import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useWorkspace } from '../workspaces/WorkspaceContext';
import { api } from '../../lib/api';
import { displayRole } from '../../lib/roles';

export default function ProfilePage() {
  const { accessToken, user } = useAuth();
  const { profile, setProfile, workspaceRole, activeWorkspace } = useWorkspace();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    setName(profile?.name || '');
  }, [profile]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    setInfo('');
    setSaving(true);
    try {
      const data = await api.patch('/me', { name: name.trim() }, accessToken);
      setProfile(data.profile);
      setInfo('Name updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-main">
      <h2>Profile</h2>
      <p className="page-lead">
        Your account details. Role comes from the current workspace
        {activeWorkspace ? ` (${activeWorkspace.name})` : ''}.
      </p>

      {error && <div className="form-error">{error}</div>}
      {info && <div className="form-info">{info}</div>}

      <dl className="profile-dl">
        <div>
          <dt>Email</dt>
          <dd>{profile?.email || user?.email}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{displayRole(workspaceRole)}</dd>
        </div>
      </dl>

      <form onSubmit={handleSave}>
        <div className="field">
          <label htmlFor="profile-name">Name</label>
          <input
            id="profile-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary profile-save" disabled={saving}>
          {saving ? 'Saving…' : 'Save name'}
        </button>
      </form>
    </div>
  );
}
