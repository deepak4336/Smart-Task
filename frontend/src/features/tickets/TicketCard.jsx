const STATUS_LABEL = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High' };

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

export default function TicketCard({ ticket, members, onUpdate }) {
  const assigneeName =
    ticket.assignee?.name || ticket.assignee?.email || 'Unassigned';

  const handleStatus = (e) => {
    onUpdate(ticket.id, { status: e.target.value });
  };

  const handlePriority = (e) => {
    onUpdate(ticket.id, { priority: e.target.value });
  };

  const handleAssignee = (e) => {
    onUpdate(ticket.id, { assigneeId: e.target.value || null });
  };

  return (
    <article className="ticket-card">
      <div className="ticket-card-title">{ticket.title}</div>
      {ticket.description && <p className="ticket-card-desc">{ticket.description}</p>}
      <div className="task-card-meta">
        <span className={`status-chip status-${ticket.status}`}>
          {STATUS_LABEL[ticket.status] || ticket.status}
        </span>
        <span className={`priority-chip priority-${ticket.priority || 'medium'}`}>
          {PRIORITY_LABEL[ticket.priority] || 'Medium'}
        </span>
      </div>
      <div className="task-assignee">{assigneeName}</div>
      {ticket.raiser && (
        <p className="ticket-raised-by">Raised by {ticket.raiser.name || ticket.raiser.email}</p>
      )}

      {ticket.canUpdate && (
        <div className="ticket-actions">
          <label className="ticket-action">
            <span>Status</span>
            <select value={ticket.status} onChange={handleStatus}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="ticket-action">
            <span>Priority</span>
            <select value={ticket.priority || 'medium'} onChange={handlePriority}>
              {Object.entries(PRIORITY_LABEL).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="ticket-action">
            <span>Assignee</span>
            <select value={ticket.assignee_id || ticket.assignee?.id || ''} onChange={handleAssignee}>
              <option value="">Unassigned</option>
              {members.map((m) => {
                const user = m.user;
                if (!user) return null;
                return (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                );
              })}
            </select>
          </label>
        </div>
      )}
    </article>
  );
}
