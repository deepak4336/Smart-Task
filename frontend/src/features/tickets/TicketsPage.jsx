import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useWorkspace } from '../workspaces/WorkspaceContext';
import { api } from '../../lib/api';
import RaiseTicketForm from './RaiseTicketForm';
import TicketCard from './TicketCard';

export default function TicketsPage() {
  const { accessToken } = useAuth();
  const { workspaces, activeWorkspaceId, setActiveWorkspaceId, activeWorkspace, loading: wsLoading } =
    useWorkspace();

  const [tickets, setTickets] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadTickets = useCallback(async () => {
    if (!accessToken || !activeWorkspaceId) {
      setTickets([]);
      setLoading(false);
      return;
    }
    try {
      const data = await api.get(`/tickets?workspaceId=${activeWorkspaceId}`, accessToken);
      setTickets(data.tickets || []);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [accessToken, activeWorkspaceId]);

  const loadMembers = useCallback(async () => {
    if (!accessToken || !activeWorkspaceId) {
      setMembers([]);
      return;
    }
    try {
      const data = await api.get(`/workspaces/${activeWorkspaceId}/members`, accessToken);
      setMembers(data.members || []);
    } catch (err) {
      setError(err.message);
    }
  }, [accessToken, activeWorkspaceId]);

  useEffect(() => {
    if (!accessToken || wsLoading) return;
    setLoading(true);
    Promise.all([loadTickets(), loadMembers()]).finally(() => setLoading(false));
  }, [accessToken, wsLoading, loadTickets, loadMembers]);

  const handleRaise = async ({ title, description, priority }) => {
    if (!activeWorkspaceId) return false;
    setSubmitting(true);
    setError('');
    try {
      await api.post(
        '/tickets',
        { workspaceId: activeWorkspaceId, title, description, priority },
        accessToken
      );
      await loadTickets();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (ticketId, body) => {
    setError('');
    try {
      const data = await api.patch(`/tickets/${ticketId}`, body, accessToken);
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? data.ticket : t)));
    } catch (err) {
      setError(err.message);
      await loadTickets();
    }
  };

  return (
    <div className="app-main app-main-wide">
      <div className="board-header">
        <div>
          <h2>Tickets</h2>
          <p className="page-lead">
            Raise and track support tickets. Distinct from board tasks.
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
        <div className="empty-state">Create a workspace on the Dashboard before raising tickets.</div>
      ) : loading ? (
        <p className="loading-state">Loading tickets…</p>
      ) : (
        <>
          {activeWorkspace && (
            <p className="muted-note ticket-workspace-note">{activeWorkspace.name}</p>
          )}
          <RaiseTicketForm onSubmit={handleRaise} submitting={submitting} />

          {tickets.length === 0 ? (
            <div className="empty-state">No tickets yet — raise the first one above.</div>
          ) : (
            <ul className="ticket-list">
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <TicketCard ticket={ticket} members={members} onUpdate={handleUpdate} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
