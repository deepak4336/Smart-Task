import { supabase } from '../config/supabaseClient.js';

export async function listWorkspaces(req, res) {
  const { data: memberships, error: memErr } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', req.user.id);

  if (memErr) return res.status(500).json({ error: memErr.message });

  const workspaceIds = memberships.map((m) => m.workspace_id);
  if (workspaceIds.length === 0) return res.json({ workspaces: [] });

  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('*')
    .in('id', workspaceIds);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ workspaces });
}

export async function createWorkspace(req, res) {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Workspace name is required' });
  }

  const { data: workspace, error } = await supabase
    .from('workspaces')
    .insert({ name: name.trim(), created_by: req.user.id })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Creator automatically becomes an admin member of their own workspace
  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({ workspace_id: workspace.id, user_id: req.user.id, role: 'admin' });

  if (memberError) return res.status(500).json({ error: memberError.message });

  res.status(201).json({ workspace });
}

export async function inviteMember(req, res) {
  const { workspaceId } = req.params;
  const { email, role = 'member' } = req.body;

  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Confirm the requester is an admin of this workspace before allowing an invite
  const { data: requesterMembership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', req.user.id)
    .single();

  if (!requesterMembership || requesterMembership.role !== 'admin') {
    return res.status(403).json({ error: 'Only workspace admins can invite members' });
  }

  const { data: invitedUser, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (userError || !invitedUser) {
    return res.status(404).json({ error: 'No user found with that email. They need to sign up first.' });
  }

  const { error: insertError } = await supabase
    .from('workspace_members')
    .insert({ workspace_id: workspaceId, user_id: invitedUser.id, role });

  if (insertError) return res.status(500).json({ error: insertError.message });

  res.status(201).json({ message: 'Member added' });
}
