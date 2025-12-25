import jwt from 'jsonwebtoken';
import { config } from '../config.js';

// Estrae il token Bearer dall'header Authorization
function extractToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

// Middleware: blocca le chiamate senza token valido
function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { email: payload.sub, roles: payload.roles || [] };
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Middleware: consente l'accesso solo agli admin
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.roles?.includes('admin')) {
    return res.status(403).json({ error: 'Admin role required' });
  }
  return next();
}

export { requireAuth, requireAdmin };
