import { supabase } from '../config/supabaseClient.js';

const LIST_LIMIT = 50;

const NOTIFICATION_SELECT =
  'id, type, message, is_read, created_at, task_id, task:tasks(id, title, board_id)';

/**
 * Insert a notification. Failures are logged and do not throw so the
 * triggering action (assign / comment / reschedule) still succeeds.
 */
export async function createNotification({ userId, type, message, taskId = null }) {
  if (!userId || !type || !message) return;

  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    message,
    task_id: taskId || null,
  });

  if (error) {
    console.error('Failed to create notification:', error.message);
  }
}

export async function listNotifications(req, res) {
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_SELECT)
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT);

  if (error) return res.status(500).json({ error: error.message });

  const rows = notifications || [];
  const unreadCount = rows.filter((n) => !n.is_read).length;

  res.json({ notifications: rows, unreadCount });
}

export async function markAllRead(req, res) {
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', req.user.id)
    .eq('is_read', false)
    .select('id');

  if (error) return res.status(500).json({ error: error.message });

  res.json({ updated: (data || []).length });
}

export async function markOneRead(req, res) {
  const { notificationId } = req.params;

  const { data: notification, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', req.user.id)
    .select(NOTIFICATION_SELECT)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!notification) return res.status(404).json({ error: 'Notification not found' });

  res.json({ notification });
}
