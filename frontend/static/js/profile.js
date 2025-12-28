import { ensureConfigured, showSetupLinks, requireToken, fetchWithAuth, setToken } from './shared.js';

const form = document.querySelector('#profileForm');
const alertBox = document.querySelector('#profileAlert');
const currentEmail = document.querySelector('#currentEmail');
const newEmail = document.querySelector('#newEmail');
const currentPassword = document.querySelector('#currentPassword');
const newPassword = document.querySelector('#newPassword');
const confirmPassword = document.querySelector('#confirmPassword');

init();

async function init() {
  const status = await ensureConfigured();
  showSetupLinks(status.setupRequired);
  if (status.setupRequired) return;

  const token = requireToken();
  if (!token) return;

  form.addEventListener('submit', handleSubmit);
  await loadProfile(token);
}

async function loadProfile(token) {
  try {
    const res = await fetchWithAuth('/api/status/me', { token });
    if (!res.ok) throw new Error('Impossibile caricare il profilo');
    const data = await res.json();
    currentEmail.value = data.email || data.user || '';
  } catch (error) {
    flash(error.message || 'Errore nel caricamento profilo', 'danger');
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  hideAlert();

  if (newPassword.value && newPassword.value !== confirmPassword.value) {
    flash('Le password non coincidono.', 'danger');
    return;
  }

  try {
    const payload = {
      current_password: currentPassword.value,
      new_email: newEmail.value.trim() || undefined,
      new_password: newPassword.value || undefined,
    };

    const res = await fetchWithAuth('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Impossibile aggiornare il profilo');
    }

    if (data.access_token) {
      setToken(data.access_token);
    }
    currentEmail.value = data.email || payload.new_email || currentEmail.value;
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
    newEmail.value = '';
    flash('Profilo aggiornato con successo.', 'success');
  } catch (error) {
    flash(error.message || 'Errore inatteso', 'danger');
    console.error(error);
  }
}

function flash(message, type) {
  alertBox.textContent = message;
  alertBox.className = `alert alert-${type}`;
  alertBox.classList.remove('d-none');
}

function hideAlert() {
  alertBox.classList.add('d-none');
}
