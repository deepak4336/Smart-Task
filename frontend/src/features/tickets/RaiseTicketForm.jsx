import { useState } from 'react';

const PRIORITIES = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
];

export default function RaiseTicketForm({ onSubmit, submitting }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const ok = await onSubmit({ title, description, priority });
    if (ok) {
      setTitle('');
      setDescription('');
      setPriority('medium');
    }
  };

  return (
    <form className="ticket-raise-form" onSubmit={handleSubmit}>
      <h3>Raise ticket</h3>
      <div className="field">
        <label htmlFor="ticket-title">Title</label>
        <input
          id="ticket-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs attention?"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="ticket-description">Description</label>
        <textarea
          id="ticket-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add details (optional)"
          rows={3}
        />
      </div>
      <div className="field">
        <label htmlFor="ticket-priority">Priority</label>
        <select
          id="ticket-priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          {PRIORITIES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn btn-primary" disabled={submitting || !title.trim()}>
        {submitting ? 'Raising…' : 'Raise ticket'}
      </button>
    </form>
  );
}
