import express from 'express';
import { requireAuth } from '../middleware/auth.js';

// Healthcheck e info utente corrente
const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ status: 'ok' });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.email, roles: req.user.roles });
});

export default router;
