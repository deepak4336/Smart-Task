import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { extractFromNotes, confirmExtractedTasks } from '../controllers/extractController.js';

const router = Router();

router.use(requireAuth);

// Basic per-user cap on Groq calls (free-tier / paid-adjacent API).
const EXTRACT_WINDOW_MS = 10 * 60 * 1000;
const EXTRACT_MAX_PER_WINDOW = 8;
const extractHits = new Map();

function rateLimitExtract(req, res, next) {
  const key = req.user?.id || req.ip;
  const now = Date.now();
  const stamps = (extractHits.get(key) || []).filter((t) => now - t < EXTRACT_WINDOW_MS);
  if (stamps.length >= EXTRACT_MAX_PER_WINDOW) {
    return res.status(429).json({
      error: 'Too many extract requests. Please wait a few minutes and try again.',
    });
  }
  stamps.push(now);
  extractHits.set(key, stamps);
  next();
}

router.post('/', rateLimitExtract, extractFromNotes);
router.post('/confirm', confirmExtractedTasks);

export default router;
