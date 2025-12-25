import express from 'express';
import { authenticate, createUser, issueToken } from '../services/userService.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

// Endpoint di autenticazione (login + register)
const router = express.Router();

router.post('/login', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing credentials' });
  }

  const user = await authenticate(email, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = issueToken(user);
  return res.json({ access_token: token, email: user.email, roles: user.roles });
});

router.post('/register', requireAuth, requireAdmin, async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  const roles = req.body.roles || ['user'];

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  try {
    const user = await createUser({ email, password, roles });
    return res.status(201).json({ email: user.email, roles: user.roles });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ error: 'User already exists' });
    }
    console.error('User registration error:', error.message);
    return res.status(500).json({ error: 'Unexpected error' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  return res.json({ email: req.user.email, roles: req.user.roles });
});

export default router;
