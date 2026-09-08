import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  listWorkspaces,
  createWorkspace,
  inviteMember,
  listMembers,
  listProjects,
  createProject,
} from '../controllers/workspaceController.js';

const router = Router();

router.use(requireAuth); // every route below requires a valid logged-in user

router.get('/', listWorkspaces);
router.post('/', createWorkspace);
router.post('/:workspaceId/invite', inviteMember);
router.get('/:workspaceId/members', listMembers);
router.get('/:workspaceId/projects', listProjects);
router.post('/:workspaceId/projects', createProject);

export default router;
