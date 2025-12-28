import express from 'express';
import { authenticate, createUser, issueToken, updateCredentials } from '../services/userService.js';
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

router.put('/profile', requireAuth, async (req, res) => {
  const body = req.body || {};
  const newEmail = (body.new_email || '').trim().toLowerCase() || null;
  const newPassword = body.new_password || null;
  const currentPassword = body.current_password || null;

  if (!newEmail && !newPassword) {
    return res.status(400).json({ error: 'Nessuna modifica richiesta' });
  }

  // Richiedi password corrente se si cambia email o password
  if (!currentPassword) {
    return res.status(400).json({ error: 'Inserisci la password corrente per confermare le modifiche' });
  }

  const result = await updateCredentials(req.user.email, { newEmail, newPassword, currentPassword });
  if (result.error) {
    if (result.error === 'invalid_password') return res.status(401).json({ error: 'Password corrente non valida' });
    if (result.error === 'email_taken') return res.status(400).json({ error: 'Email già in uso' });
    if (result.error === 'no_changes') return res.status(400).json({ error: 'Nessuna modifica rilevata' });
    if (result.error === 'not_found') return res.status(404).json({ error: 'Utente non trovato' });
    return res.status(400).json({ error: 'Impossibile aggiornare il profilo' });
  }

  const token = issueToken(result.user);
  return res.json({ email: result.user.email, roles: result.user.roles, access_token: token });
});

export default router;
