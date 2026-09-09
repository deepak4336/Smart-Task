import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useWorkspace } from './WorkspaceContext';
import { api } from '../../lib/api';
import { displayRole } from '../../lib/roles';

const TASK_STATUS_LABELS = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

const SCOPE_COPY = {
  workspace: 'Workload for everyone in this workspace.',
  team: "Workload for people on your team's projects.",
  self: 'Your assigned task load in this workspace.',
};

function sumCounts(counts = {}) {
  return Object.values(counts).reduce((n, v) => n + Number(v || 0), 0);
}

function formatEffort(value, metric) {
  const n = Number(value || 0);
  if (metric === 'estimated_hours') {
    const rounded = Number.isInteger(n) ? String(n) : n.toFixed(1);
    return `${rounded}h`;
  }
  return `${n} open`;
}

function StatusBars({ counts }) {
  const total = sumCounts(counts);
  return (
    <ul className="report-bars">
      {Object.keys(TASK_STATUS_LABELS).map((key) => {
        const value = Number(counts?.[key] || 0);
        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
        return (
          <li key={key} className="report-bar-row">
            <span className="report-bar-label">{TASK_STATUS_LABELS[key]}</span>
            <div className="report-bar-track" aria-hidden="true">
              <div className={`report-bar-fill report-bar-fill-${key}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="report-bar-count">
              {value}
              <span className="report-bar-pct">{pct}%</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function WorkloadBalance({ people, effortMetric }) {
  const maxEffort = Math.max(1, ...people.map((p) => Number(p.effort || 0)));

  return (
    <ul className="report-bars workload-bars">
      {people.map((person) => {
        const effort = Number(person.effort || 0);
        const pct = Math.round((effort / maxEffort) * 100);
        const heavy = people.length > 1 && pct >= 80 && effort > 0;
        return (
          <li key={person.userId} className="report-bar-row workload-bar-row">
            <span className="report-bar-label workload-bar-name">
              {person.name}
              <span className="workload-bar-role">{displayRole(person.role)}</span>
            </span>
            <div
              className="report-bar-track"
              aria-label={`${person.name} ${formatEffort(effort, effortMetric)}`}
            >
              <div
                className={`report-bar-fill${heavy ? ' report-bar-fill-high' : ''}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="report-bar-count">
              {formatEffort(effort, effortMetric)}
              <span className="report-bar-pct">{person.totalTasks} tasks</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function WorkspaceDashboard() {
  const { accessToken } = useAuth();
  const {
    workspaces,
    refresh,
    activeWorkspaceId,
    setActiveWorkspaceId,
    activeWorkspace,
    loading: wsLoading,
  } = useWorkspace();

  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const [workload, setWorkload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadWorkload = useCallback(async () => {
    if (!accessToken || !activeWorkspaceId) {
      setWorkload(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api.get(`/workload?workspaceId=${activeWorkspaceId}`, accessToken);
      setWorkload(data);
      setError('');
    } catch (err) {
      setError(err.message);
      setWorkload(null);
    }
  }, [accessToken, activeWorkspaceId]);

  useEffect(() => {
    if (!accessToken || wsLoading) return;
    setLoading(true);
    loadWorkload().finally(() => setLoading(false));
  }, [accessToken, wsLoading, loadWorkload]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreateError('');
    setCreating(true);
    try {
      await api.post('/workspaces', { name: newName }, accessToken);
      setNewName('');
      await refresh();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const people = workload?.people || [];
  const selfView = workload?.scope === 'self';
  const self = people[0] || null;
  const effortLabel =
    workload?.effortMetric === 'estimated_hours'
      ? 'Open effort (estimated hours)'
      : 'Open / in-progress tasks';

  return (
    <div className="app-main app-main-wide">
      <div className="board-header">
        <div>
          <h2>Dashboard</h2>
          <p className="page-lead">
            Workload balance
            {activeWorkspace ? ` — ${activeWorkspace.name}` : ''}
          </p>
        </div>
        {workspaces.length > 1 && (
          <select
            className="ticket-workspace-select"
            value={activeWorkspaceId || ''}
            onChange={(e) => setActiveWorkspaceId(e.target.value)}
            aria-label="Workspace"
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <div className="form-error">{error}</div>}

      {workspaces.length === 0 ? (
        <div className="empty-state">Create a workspace below to start tracking workload.</div>
      ) : loading ? (
        <p className="loading-state">Loading workload…</p>
      ) : !workload ? (
        <div className="empty-state">No workload data yet.</div>
      ) : (
        <>
          <p className="muted-note">{SCOPE_COPY[workload.scope] || SCOPE_COPY.self}</p>

          {selfView && self ? (
            <div className="report-grid">
              <section className="report-card">
                <h3>Your load</h3>
                <p className="report-card-meta">
                  {self.totalTasks} assigned · {formatEffort(self.effort, workload.effortMetric)} open
                </p>
                <StatusBars counts={self.tasksByStatus} />
              </section>
              <section className="report-card">
                <h3>Effort</h3>
                <p className="report-card-meta">{effortLabel}</p>
                <p className="workload-effort-figure">{formatEffort(self.effort, workload.effortMetric)}</p>
                <p className="muted-note">
                  {self.openTasks} task{self.openTasks === 1 ? '' : 's'} still open or in progress.
                </p>
              </section>
            </div>
          ) : people.length === 0 ? (
            <div className="empty-state">No people in this workload scope yet.</div>
          ) : (
            <div className="report-grid">
              <section className="report-card report-card-wide">
                <h3>Team load</h3>
                <p className="report-card-meta">
                  {effortLabel} — bars are relative so the heaviest load stands out
                </p>
                <WorkloadBalance people={people} effortMetric={workload.effortMetric} />
              </section>
              {people.map((person) => (
                <section key={person.userId} className="report-card">
                  <h3>{person.name}</h3>
                  <p className="report-card-meta">
                    {displayRole(person.role)} · {person.totalTasks} tasks ·{' '}
                    {formatEffort(person.effort, workload.effortMetric)}
                  </p>
                  <StatusBars counts={person.tasksByStatus} />
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <section className="workload-workspaces">
        <h3>Workspaces</h3>
        <p className="muted-note">Open a workspace to manage projects and boards.</p>

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

        {createError && <div className="form-error">{createError}</div>}

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
      </section>
    </div>
  );
}
