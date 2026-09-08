import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  listTickets,
  createTicket,
  getTicket,
  updateTicket,
  deleteTicket,
} from '../controllers/ticketController.js';

const router = Router();

router.use(requireAuth);

router.get('/', listTickets);
router.post('/', createTicket);
router.get('/:ticketId', getTicket);
router.patch('/:ticketId', updateTicket);
router.delete('/:ticketId', deleteTicket);

export default router;
