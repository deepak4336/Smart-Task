import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  listNotifications,
  markAllRead,
  markOneRead,
} from '../controllers/notificationController.js';

const router = Router();

router.use(requireAuth);

router.get('/', listNotifications);
router.patch('/', markAllRead);
router.patch('/:notificationId', markOneRead);

export default router;
