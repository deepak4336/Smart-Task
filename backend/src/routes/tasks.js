import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  listTasks,
  createTask,
  getTask,
  updateTask,
  deleteTask,
  listComments,
  addComment,
} from '../controllers/taskController.js';

const router = Router();

router.use(requireAuth);

router.get('/', listTasks);
router.post('/', createTask);
router.get('/:taskId', getTask);
router.patch('/:taskId', updateTask);
router.delete('/:taskId', deleteTask);

router.get('/:taskId/comments', listComments);
router.post('/:taskId/comments', addComment);

export default router;
