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
import {
  listDependencies,
  createDependency,
  deleteDependency,
} from '../controllers/dependencyController.js';

const router = Router();

router.use(requireAuth);

router.get('/', listTasks);
router.post('/', createTask);
router.get('/:taskId', getTask);
router.patch('/:taskId', updateTask);
router.delete('/:taskId', deleteTask);

router.get('/:taskId/comments', listComments);
router.post('/:taskId/comments', addComment);

router.get('/:taskId/dependencies', listDependencies);
router.post('/:taskId/dependencies', createDependency);
router.delete('/:taskId/dependencies/:dependencyId', deleteDependency);

export default router;
