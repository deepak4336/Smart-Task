import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { getWorkspaceWorkload } from '../controllers/workloadController.js';

const router = Router();

router.use(requireAuth);

router.get('/', getWorkspaceWorkload);

export default router;
