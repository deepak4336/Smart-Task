import { supabase } from '../config/supabaseClient.js';

export async function getMe(req, res) {
  const { data: profile, error } = await supabase
    .from('users')
    .select('id, name, email, role, created_at')
    .eq('id', req.user.id)
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const { data: memberships, error: memErr } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspace:workspaces(id, name)')
    .eq('user_id', req.user.id);

  if (memErr) return res.status(500).json({ error: memErr.message });

  res.json({ profile, memberships: memberships || [] });
}

export async function updateMe(req, res) {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const { data: profile, error } = await supabase
    .from('users')
    .update({ name: name.trim() })
    .eq('id', req.user.id)
    .select('id, name, email, role, created_at')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ profile });
}
