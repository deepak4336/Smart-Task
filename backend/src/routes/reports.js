import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { getWorkspaceReport } from '../controllers/reportController.js';

const router = Router();

router.use(requireAuth);

router.get('/', getWorkspaceReport);

export default router;
