import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { collection } from '../db.js';
import { config } from '../config.js';

// Normalizza il documento Mongo in un oggetto user leggero
function normalizeUser(doc) {
  if (!doc) return null;
  return {
    email: doc.email,
    roles: doc.roles || [],
    created_at: doc.created_at,
  };
}

async function fetchRawByEmail(email) {
  if (!email) return null;
  return collection('users').findOne({ email: email.toLowerCase() });
}

async function findByEmail(email) {
  return normalizeUser(await fetchRawByEmail(email));
}

async function hasUsers() {
  const count = await collection('users').countDocuments();
  return count > 0;
}

async function createUser({ email, password, roles = ['user'] }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const document = {
    email: email.toLowerCase(),
    password_hash: passwordHash,
    roles,
    created_at: new Date(),
  };
  await collection('users').insertOne(document);
  return normalizeUser(document);
}

async function authenticate(email, password) {
  const user = await collection('users').findOne({ email: email.toLowerCase() });
  if (!user) return null;
  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) return null;
  return normalizeUser(user);
}

// Genera un JWT con email e ruoli
function issueToken(user) {
  return jwt.sign(
    { sub: user.email, roles: user.roles || [] },
    config.jwtSecret,
    config.jwtExpiresIn ? { expiresIn: config.jwtExpiresIn } : undefined,
  );
}

// Aggiorna email/password per l'utente autenticato
async function updateCredentials(currentEmail, { newEmail, currentPassword, newPassword }) {
  const email = (currentEmail || '').toLowerCase();
  const user = await fetchRawByEmail(email);
  if (!user) return { error: 'not_found' };

  const updates = {};
  let targetEmail = email;

  if (newEmail || newPassword) {
    const matches = await bcrypt.compare(currentPassword || '', user.password_hash);
    if (!matches) return { error: 'invalid_password' };
  }

  if (newEmail && newEmail.toLowerCase() !== email) {
    const existing = await fetchRawByEmail(newEmail);
    if (existing) return { error: 'email_taken' };
    targetEmail = newEmail.toLowerCase();
    updates.email = targetEmail;
  }

  if (newPassword) {
    updates.password_hash = await bcrypt.hash(newPassword, 10);
  }

  if (!Object.keys(updates).length) return { error: 'no_changes' };

  await collection('users').updateOne({ email }, { $set: updates });
  const updated = normalizeUser({ ...user, ...updates });
  return { user: updated };
}

// Se non esistono utenti, crea l'admin di default da env
async function ensureDefaultAdmin() {
  if (await hasUsers()) {
    return { created: false };
  }
  const { adminEmail, adminPassword } = config.defaults;
  if (!adminEmail || !adminPassword) {
    return { created: false };
  }
  const user = await createUser({ email: adminEmail, password: adminPassword, roles: ['admin'] });
  return { created: true, email: user.email };
}

export { authenticate, issueToken, createUser, findByEmail, hasUsers, ensureDefaultAdmin, updateCredentials };
