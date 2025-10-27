const form = document.querySelector('#setupForm');
const alertBox = document.querySelector('#setupAlert');
const demoSwitch = document.querySelector('#demoSwitch');

async function fetchStatus() {
  try {
    const response = await fetch('/api/setup/status');
    if (!response.ok) return;
    const payload = await response.json();
    if (payload.configured) {
      window.location.href = '/index.html';
    }
  } catch (error) {
    console.error('Errore nel recupero dello stato setup', error);
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
    demo: demoSwitch.checked,
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
        const redirect = demoSwitch.checked ? '/index.html?demo=1' : '/index.html';
        window.location.href = redirect;
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

fetchStatus();
