import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  listBoards,
  createBoard,
  getBoard,
  updateBoard,
  deleteBoard,
} from '../controllers/boardController.js';

const router = Router();

router.use(requireAuth);

router.get('/', listBoards);
router.post('/', createBoard);
router.get('/:boardId', getBoard);
router.patch('/:boardId', updateBoard);
router.delete('/:boardId', deleteBoard);

export default router;
