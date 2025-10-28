import { ensureConfigured, showSetupLinks } from './shared.js';

const form = document.querySelector('#setupForm');
const alertBox = document.querySelector('#setupAlert');

init();

async function init() {
  const status = await ensureConfigured();
  showSetupLinks(status.setupRequired);
  if (!status.setupRequired) {
    window.location.href = '/index.html';
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideAlert();

  const payload = {
    admin_email: document.querySelector('#adminEmail').value.trim(),
    admin_password: document.querySelector('#adminPassword').value,
    mqtt_host: document.querySelector('#mqttHost').value.trim() || undefined,
    mqtt_port: document.querySelector('#mqttPort').value || undefined,
    mqtt_username: document.querySelector('#mqttUsername').value.trim() || undefined,
    mqtt_password: document.querySelector('#mqttPassword').value || undefined,
  };

  try {
    const response = await fetch('/api/setup/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.error || 'Setup non riuscito');
    }

    const data = await response.json();
    if (data.configured) {
      showAlert('Configurazione completata! Verrai reindirizzato...', 'success');
      setTimeout(() => {
        window.location.href = '/index.html';
      }, 1200);
    }
  } catch (error) {
    showAlert(error.message || 'Errore inatteso durante la configurazione.', 'danger');
    console.error(error);
  }
});

function showAlert(message, type) {
  alertBox.textContent = message;
  alertBox.className = `alert alert-${type}`;
  alertBox.classList.remove('d-none');
}

function hideAlert() {
  alertBox.classList.add('d-none');
}
