import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { getMe, updateMe } from '../controllers/meController.js';

const router = Router();

router.use(requireAuth);
router.get('/', getMe);
router.patch('/', updateMe);

export default router;
