import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

function suggestionToRow(item, index) {
  return {
    key: `${index}-${item.title}`,
    selected: true,
    title: item.title || '',
    dueDate: item.suggestedDueDate || '',
    assigneeId: item.assigneeId || '',
    suggestedAssigneeName: item.suggestedAssigneeName || '',
    matchConfidence: item.matchConfidence || 'none',
  };
}

export default function ExtractTasksModal({
  open,
  boardId,
  members,
  accessToken,
  onClose,
  onSaved,
}) {
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (!open) return;
    setNotes('');
    setRows(null);
    setError('');
    setInfo('');
    setExtracting(false);
    setSaving(false);
  }, [open]);

  const setRow = (key, patch) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const handleExtract = async (e) => {
    e.preventDefault();
    if (!notes.trim()) return;
    setExtracting(true);
    setError('');
    setInfo('');
    setRows(null);

    try {
      const data = await api.post(
        '/extract-tasks',
        { notes: notes.trim(), boardId },
        accessToken
      );
      const suggestions = data.suggestions || [];
      setRows(suggestions.map(suggestionToRow));
      if (suggestions.length === 0) {
        setInfo('No clear action items were found in these notes.');
      } else if (data.cached) {
        setInfo('Showing a recent extraction of the same notes (cached).');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setExtracting(false);
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    const selected = (rows || []).filter((row) => row.selected && row.title.trim());
    if (selected.length === 0) {
      setError('Select at least one task with a title.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await api.post(
        '/extract-tasks/confirm',
        {
          boardId,
          tasks: selected.map((row) => ({
            title: row.title.trim(),
            dueDate: row.dueDate || null,
            assigneeId: row.assigneeId || null,
          })),
        },
        accessToken
      );
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const selectedCount = (rows || []).filter((row) => row.selected && row.title.trim()).length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel extract-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Extract from notes</h3>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="extract-lead">
          Paste meeting notes. Suggested tasks are previewed first — nothing is added until you
          confirm.
        </p>

        {error && <div className="form-error">{error}</div>}
        {info && <div className="form-info">{info}</div>}

        {rows === null ? (
          <form onSubmit={handleExtract}>
            <div className="field">
              <label htmlFor="meeting-notes">Meeting notes</label>
              <textarea
                id="meeting-notes"
                rows={12}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Priya will send the revised timeline by Friday. Raj to book the client demo next week."
                required
              />
            </div>
            <div className="modal-actions">
              <button type="submit" className="btn btn-primary" disabled={extracting || !notes.trim()}>
                {extracting ? 'Extracting…' : 'Extract tasks'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleConfirm}>
            {rows.length > 0 && (
              <ul className="extract-list">
                {rows.map((row) => (
                  <li key={row.key} className={`extract-item${row.selected ? '' : ' is-unchecked'}`}>
                    <label className="extract-check">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={(e) => setRow(row.key, { selected: e.target.checked })}
                      />
                      <span>Include</span>
                    </label>

                    <div className="field">
                      <label htmlFor={`extract-title-${row.key}`}>Title</label>
                      <input
                        id={`extract-title-${row.key}`}
                        value={row.title}
                        onChange={(e) => setRow(row.key, { title: e.target.value })}
                        required={row.selected}
                      />
                    </div>

                    <div className="field-row">
                      <div className="field">
                        <label htmlFor={`extract-due-${row.key}`}>Due date</label>
                        <input
                          id={`extract-due-${row.key}`}
                          type="date"
                          value={row.dueDate}
                          onChange={(e) => setRow(row.key, { dueDate: e.target.value })}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`extract-assignee-${row.key}`}>Assignee</label>
                        <select
                          id={`extract-assignee-${row.key}`}
                          value={row.assigneeId}
                          onChange={(e) => setRow(row.key, { assigneeId: e.target.value })}
                        >
                          <option value="">Unassigned</option>
                          {members.map((m) => (
                            <option key={m.user.id} value={m.user.id}>
                              {m.user.name || m.user.email}
                            </option>
                          ))}
                        </select>
                        {row.suggestedAssigneeName && !row.assigneeId && (
                          <p className="extract-hint">
                            Mentioned “{row.suggestedAssigneeName}” — no confident member match.
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="modal-actions extract-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setRows(null);
                  setInfo('');
                  setError('');
                }}
                disabled={saving}
              >
                Edit notes
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || selectedCount === 0}
              >
                {saving
                  ? 'Adding…'
                  : `Confirm and add ${selectedCount} to board`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
