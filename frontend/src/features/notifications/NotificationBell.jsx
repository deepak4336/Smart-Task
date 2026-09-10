import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../lib/api';

const TYPE_LABELS = {
  assigned: 'Assigned',
  comment: 'Comment',
  dependency_shift: 'Schedule change',
  due_soon: 'Due soon',
  overdue: 'Overdue',
};

function timeAgo(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationBell() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const rootRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await api.get('/notifications', accessToken);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount ?? (data.notifications || []).filter((n) => !n.is_read).length);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      await load();
      setLoading(false);
    }
  };

  const openNotification = async (item) => {
    if (!item.is_read) {
      try {
        await api.patch(`/notifications/${item.id}`, {}, accessToken);
        setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch (err) {
        setError(err.message);
      }
    }

    const taskId = item.task_id;
    const boardId = item.task?.board_id;
    setOpen(false);
    if (taskId && boardId) {
      navigate(`/boards/${boardId}?task=${taskId}`);
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications', {}, accessToken);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      setError(err.message);
    }
  };

  const badge = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <div className="notif-bell" ref={rootRef}>
      <button
        type="button"
        className="notif-bell-button"
        aria-label={unreadCount ? `${unreadCount} unread notifications` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggle}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 9a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 && <span className="notif-bell-badge">{badge}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-panel-header">
            <strong>Notifications</strong>
            <button
              type="button"
              className="btn-ghost"
              onClick={markAllRead}
              disabled={unreadCount === 0}
            >
              Mark all as read
            </button>
          </div>
          {error && <div className="form-error notif-panel-error">{error}</div>}
          {loading ? (
            <p className="loading-state notif-empty">Loading…</p>
          ) : notifications.length === 0 ? (
            <p className="muted-note notif-empty">No notifications yet.</p>
          ) : (
            <ul className="notif-list">
              {notifications.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`notif-item${item.is_read ? '' : ' is-unread'}`}
                    onClick={() => openNotification(item)}
                  >
                    <span className="notif-item-meta">
                      <span className="notif-item-type">{TYPE_LABELS[item.type] || item.type}</span>
                      <span className="notif-item-time">{timeAgo(item.created_at)}</span>
                    </span>
                    <span className="notif-item-message">{item.message}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
