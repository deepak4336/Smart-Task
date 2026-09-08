import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useWorkspace } from '../workspaces/WorkspaceContext';
import { api } from '../../lib/api';

const TASK_STATUS_LABELS = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

const PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const TICKET_STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const SCOPE_COPY = {
  workspace: 'Stats for the whole workspace.',
  team: "Stats for your team's projects and employees.",
  self: 'Stats for your own tasks and tickets.',
};

function sumCounts(counts = {}) {
  return Object.values(counts).reduce((n, v) => n + Number(v || 0), 0);
}

function formatTrendDay(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
}

function StatBars({ counts, labels }) {
  const total = sumCounts(counts);
  const entries = Object.keys(labels);

  return (
    <ul className="report-bars">
      {entries.map((key) => {
        const value = Number(counts?.[key] || 0);
        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
        return (
          <li key={key} className="report-bar-row">
            <span className="report-bar-label">{labels[key]}</span>
            <div className="report-bar-track" aria-hidden="true">
              <div
                className={`report-bar-fill report-bar-fill-${key}`}
                style={{ width: `${pct}%` }}
              />
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

function CompletionTrend({ trend = [] }) {
  const max = Math.max(1, ...trend.map((d) => Number(d.count || 0)));

  return (
    <ul className="report-trend">
      {trend.map((day) => {
        const count = Number(day.count || 0);
        const pct = Math.round((count / max) * 100);
        return (
          <li key={day.date} className="report-trend-day">
            <span className="report-trend-count">{count}</span>
            <div className="report-trend-track" aria-hidden="true">
              <div className="report-trend-fill" style={{ height: `${pct}%` }} />
            </div>
            <span className="report-trend-label">{formatTrendDay(day.date)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default function ReportsPage() {
  const { accessToken } = useAuth();
  const { workspaces, activeWorkspaceId, setActiveWorkspaceId, activeWorkspace, loading: wsLoading } =
    useWorkspace();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = useCallback(async () => {
    if (!accessToken || !activeWorkspaceId) {
      setReport(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api.get(`/reports?workspaceId=${activeWorkspaceId}`, accessToken);
      setReport(data);
      setError('');
    } catch (err) {
      setError(err.message);
      setReport(null);
    }
  }, [accessToken, activeWorkspaceId]);

  useEffect(() => {
    if (!accessToken || wsLoading) return;
    setLoading(true);
    loadReport().finally(() => setLoading(false));
  }, [accessToken, wsLoading, loadReport]);

  const taskTotal = sumCounts(report?.tasksByStatus);
  const ticketTotal = sumCounts(report?.ticketsByStatus);

  return (
    <div className="app-main app-main-wide">
      <div className="board-header">
        <div>
          <h2>Reports</h2>
          <p className="page-lead">
            Status, priority, and completion at a glance
            {activeWorkspace ? ` — ${activeWorkspace.name}` : ''}.
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
        <div className="empty-state">Create a workspace on the Dashboard before viewing reports.</div>
      ) : loading ? (
        <p className="loading-state">Loading reports…</p>
      ) : !report ? (
        <div className="empty-state">No report data yet.</div>
      ) : (
        <>
          <p className="muted-note">{SCOPE_COPY[report.scope] || SCOPE_COPY.self}</p>

          <div className="report-grid">
            <section className="report-card">
              <h3>Tasks by status</h3>
              <p className="report-card-meta">{taskTotal} tasks</p>
              <StatBars counts={report.tasksByStatus} labels={TASK_STATUS_LABELS} />
            </section>

            <section className="report-card">
              <h3>Tasks by priority</h3>
              <p className="report-card-meta">{taskTotal} tasks</p>
              <StatBars counts={report.tasksByPriority} labels={PRIORITY_LABELS} />
            </section>

            <section className="report-card">
              <h3>Tickets by status</h3>
              <p className="report-card-meta">{ticketTotal} tickets</p>
              <StatBars counts={report.ticketsByStatus} labels={TICKET_STATUS_LABELS} />
            </section>

            <section className="report-card report-card-wide">
              <h3>Completion trend</h3>
              <p className="report-card-meta">Tasks marked done in the last 7 days</p>
              <CompletionTrend trend={report.completionTrend} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
