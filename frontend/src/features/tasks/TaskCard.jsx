const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High' };

export default function TaskCard({ task, onOpen, onDragStart }) {
  return (
    <article
      className="task-card"
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onClick={() => onOpen(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(task);
        }
      }}
    >
      <div className="task-card-title">{task.title}</div>
      <div className="task-card-meta">
        <span className={`priority-chip priority-${task.priority || 'medium'}`}>
          {PRIORITY_LABEL[task.priority] || 'Medium'}
        </span>
        {task.due_date && (
          <span className="task-due">{task.due_date}</span>
        )}
      </div>
      {task.assignee && (
        <div className="task-assignee">{task.assignee.name || task.assignee.email}</div>
      )}
    </article>
  );
}
