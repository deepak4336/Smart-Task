import { supabase } from '../config/supabaseClient.js';

/** Resolve project → workspace and confirm the user is a member. */
async function assertProjectAccess(userId, projectId) {
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, workspace_id, name')
    .eq('id', projectId)
    .single();

  if (error || !project) return { error: { status: 404, message: 'Project not found' } };

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', project.workspace_id)
    .eq('user_id', userId)
    .single();

  if (!membership) {
    return { error: { status: 403, message: 'Not a member of this workspace' } };
  }

  return { project, membership };
}

/** Resolve board → project → workspace and confirm membership. */
async function assertBoardAccess(userId, boardId) {
  const { data: board, error } = await supabase
    .from('boards')
    .select('id, name, project_id, projects(id, workspace_id, name)')
    .eq('id', boardId)
    .single();

  if (error || !board) return { error: { status: 404, message: 'Board not found' } };

  const workspaceId = board.projects?.workspace_id;
  if (!workspaceId) return { error: { status: 404, message: 'Board not found' } };

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single();

  if (!membership) {
    return { error: { status: 403, message: 'Not a member of this workspace' } };
  }

  return { board, membership, workspaceId };
}

export async function listBoards(req, res) {
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ error: 'projectId query param is required' });

  const access = await assertProjectAccess(req.user.id, projectId);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });

  const { data: boards, error } = await supabase
    .from('boards')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ boards });
}

export async function createBoard(req, res) {
  const { projectId, name } = req.body;
  if (!projectId) return res.status(400).json({ error: 'projectId is required' });
  if (!name || !name.trim()) return res.status(400).json({ error: 'Board name is required' });

  const access = await assertProjectAccess(req.user.id, projectId);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });

  const { data: board, error } = await supabase
    .from('boards')
    .insert({ project_id: projectId, name: name.trim() })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ board });
}

export async function getBoard(req, res) {
  const { boardId } = req.params;

  const access = await assertBoardAccess(req.user.id, boardId);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });

  const { board, workspaceId } = access;
  res.json({
    board: {
      id: board.id,
      name: board.name,
      project_id: board.project_id,
      workspace_id: workspaceId,
      project_name: board.projects?.name,
    },
  });
}

export async function updateBoard(req, res) {
  const { boardId } = req.params;
  const { name } = req.body;

  const access = await assertBoardAccess(req.user.id, boardId);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });

  if (!name || !name.trim()) return res.status(400).json({ error: 'Board name is required' });

  const { data: board, error } = await supabase
    .from('boards')
    .update({ name: name.trim() })
    .eq('id', boardId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ board });
}

export async function deleteBoard(req, res) {
  const { boardId } = req.params;

  const access = await assertBoardAccess(req.user.id, boardId);
  if (access.error) return res.status(access.error.status).json({ error: access.error.message });

  const { error } = await supabase.from('boards').delete().eq('id', boardId);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ message: 'Board deleted' });
}

// Exported for taskController membership checks via board id
export { assertBoardAccess };
